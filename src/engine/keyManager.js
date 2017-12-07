// @flow
import type { AbcSpendTarget } from 'airbitz-core-types'
import type { UtxoObj, AddressObj, AddressCache } from './engine-state.js'
// $FlowFixMe
import buffer from 'buffer-hack'
import bcoin from 'bcoin'
import crypto from 'crypto'

// $FlowFixMe
const { Buffer } = buffer

const GAP_LIMIT = 10
const UNUSED = 0
const LEASED = 1
const USED = 2
const RBF_SEQUENCE_NUM = 0xffffffff - 2
const nop = () => {}

export type Txid = string
export type WalletType = string
export type RawTx = string

export type Key = {
  state: number,
  displayAddress: string,
  scriptHash: string,
  index: number
}

export type KeyRing = {
  pubKey: any,
  privKey: any,
  children: Array<Key>
}

export type Keys = {
  master: KeyRing,
  receive: KeyRing,
  change: KeyRing
}

export type RawKey = string

export type RawKeyRing = {
  xpriv?: RawKey,
  xpub?: string
}

export type RawKeys = {
  master?: RawKeyRing,
  receive?: RawKeyRing,
  change?: RawKeyRing
}

export type createTxOptions = {
  outputs: Array<AbcSpendTarget>,
  utxos: Array<{
    utxo: UtxoObj,
    rawTx: RawTx,
    height: number
  }>,
  height: number,
  rate: number,
  maxFee: number,
  setRBF?: boolean,
  RBFraw?: RawTx,
  CPFP?: Txid,
  CPFPlimit?: number
}

export interface KeyManagerCallbacks {
  // When deriving new address send it to caching and subscribing
  +onNewAddress?: (scriptHash: string, address: string, path: string) => void;
  // When deriving new key send it to caching
  +onNewKey?: (keys: any) => void;
}

export type KeyManagerOptions = {
  walletType: WalletType,
  rawKeys?: RawKeys,
  seed?: string,
  gapLimit: number,
  network: string,
  callbacks: KeyManagerCallbacks,
  addressCache?: AddressCache
}

export class KeyManager {
  bip: string
  masterPath: string
  currencyName: string
  network: string
  gapLimit: number
  keys: Keys
  onNewAddress: (scriptHash: string, address: string, path: string) => void
  onNewKey: (keys: any) => void
  addressCache: AddressCache
  seed: string

  constructor ({
    walletType,
    rawKeys = {},
    seed = '',
    gapLimit = GAP_LIMIT,
    network,
    callbacks,
    addressCache = {}
  }: KeyManagerOptions) {
    // Check for any way to init the wallet with either a seed or master keys
    if (seed === '' && (!rawKeys.master ||
      (!rawKeys.master.xpriv && !rawKeys.master.xpub))) {
      throw new Error('Missing Master Key')
    }
    this.seed = seed
    // Create KeyRing templates
    this.keys = {
      master: {
        pubKey: null,
        privKey: null,
        children: []
      },
      receive: {
        pubKey: null,
        privKey: null,
        children: []
      },
      change: {
        pubKey: null,
        privKey: null,
        children: []
      }
    }
    // Try to load as many keys as possible from the cache
    for (const branch in rawKeys) {
      if (rawKeys[branch].xpriv) {
        this.keys[branch].privKey = bcoin.hd.PrivateKey.fromBase58(
          rawKeys[branch].xpriv,
          this.network
        )
      }
      if (rawKeys[branch].xpub) {
        this.keys[branch].pubKey = bcoin.hd.PublicKey.fromBase58(
          rawKeys[branch].xpub,
          this.network
        )
      }
    }
    // Create master derivation path from network and bip type
    this.network = network
    const bip = walletType.split('-')[1]
    this.bip = bip && bip.includes('bip') ? bip : 'bip32'
    switch (this.bip) {
      case 'bip32':
        this.masterPath = 'm/0'
        break
      case 'bip44':
        this.masterPath = "m/44'/0'/0'"
        break
      case 'bip49':
        this.masterPath = "m/49'/0'/0'"
        break
      default:
        throw new Error('Unknown bip type')
    }

    // Setup gapLimit
    this.gapLimit = gapLimit

    // Set the callbacks with nops as default
    const {
      onNewAddress = nop,
      onNewKey = nop
    } = callbacks
    this.onNewAddress = onNewAddress
    this.onNewKey = onNewKey
    this.addressCache = addressCache

    // Load addresses from Cache
    for (const scriptHash in this.addressCache) {
      const address: AddressObj = this.addressCache[scriptHash]
      const { txids, displayAddress, path } = address
      let [branch, index] = path.split(this.masterPath + '/')[1].split('/')
      branch = parseInt(branch)
      index = parseInt(index)
      const state = txids && txids.length > 0 ? USED : UNUSED
      const key = { state, displayAddress, scriptHash, index }
      if (branch === 0) {
        this.keys.receive.children.push(key)
      } else {
        this.keys.change.children.push(key)
      }
    }
    // Cache is not sorted so sort addresses according to derivation index
    this.keys.receive.children.sort((a, b) => a.index - b.index)
    this.keys.change.children.sort((a, b) => a.index - b.index)
  }

  // ////////////////////////////////////////////// //
  // /////////////// Public API /////////////////// //
  // ////////////////////////////////////////////// //
  async load () {
    // If we don't have any master key we will now create it from seed
    if (!this.keys.master.privKey && !this.keys.master.pubKey) {
      const privateKey = await this.getPrivateFromSeed(this.seed)
      this.keys.master.privKey = privateKey.derivePath(this.masterPath)
      this.keys.master.pubKey = this.keys.master.privKey.toPublic()
      this.saveKeysToCache()
    } else if (!this.keys.master.pubKey) {
      this.keys.master.pubKey = this.keys.master.privKey.toPublic()
      this.saveKeysToCache()
    }
    await this.setLookAhead()
  }

  getReceiveAddress (): string {
    return this.getNextAvailable(this.keys.receive.children)
  }

  getChangeAddress (): string {
    if (this.bip === 'bip32') return this.getReceiveAddress()
    return this.getNextAvailable(this.keys.change.children)
  }

  async use (scriptHash: string) {
    const keyToUse: ?Key = this.scriptHashToKey(scriptHash)
    if (keyToUse) keyToUse.state = USED
    await this.setLookAhead()
  }

  async unuse (scriptHash: string) {
    const keyToUnsue: ?Key = this.scriptHashToKey(scriptHash)
    if (keyToUnsue) keyToUnsue.state = UNUSED
    await this.setLookAhead()
  }

  async lease (scriptHash: string) {
    const keyToLease: ?Key = this.scriptHashToKey(scriptHash)
    if (keyToLease) keyToLease.state = LEASED
    await this.setLookAhead()
  }

  async createTX ({
    outputs,
    utxos,
    height,
    rate,
    maxFee,
    setRBF = false,
    RBFraw = '',
    CPFP = '',
    CPFPlimit = 1
  }: createTxOptions): any {
    // If it's not a CPFP transaction it has to have outputs
    // CPFP transactions can receive an empty outputs array
    if (outputs.length === 0 && CPFP !== '') throw new Error('No outputs available.')

    // If it's not a CPFP transaction it has to have outputs
    const mtx = new bcoin.primitives.MTX()
    let subtractFee = false
    // Add the outputs
    for (const spendTarget of outputs) {
      const value = parseInt(spendTarget.nativeAmount)
      const script = bcoin.script.fromAddress(spendTarget.publicAddress)
      mtx.addOutput(script, value)
    }

    if (CPFP) {
      utxos = utxos.filter(({ utxo }) => utxo.txid === CPFP)
      // If not outputs are given try and build the most efficient TX
      if (!mtx.outputs || mtx.outputs.length === 0) {
        // Sort the UTXO's by size
        utxos = utxos.sort((a, b) => parseInt(b.utxo.value) - parseInt(a.utxo.value))
        // Try and get only the biggest UTXO's unless the limit is 0 which means take all
        if (CPFPlimit) utxos = utxos.slice(0, CPFPlimit)
        // CPFP transactions will try to not have change
        // by subtracting moving all the value from the UTXO's
        // and substracting the fee from the total output value
        const value = utxos.reduce((s, { utxo }) => s + utxo.value, 0)
        subtractFee = true
        // CPFP transactions will add a change address as a single output
        const addressForOutput = this.getChangeAddress()
        const script = bcoin.script.fromAddress(addressForOutput)
        mtx.addOutput(script, value)
      }
    }

    const coins = utxos.map(({utxo, rawTx, height}) => {
      const bcoinTX = bcoin.primitives.TX.fromRaw(rawTx, 'hex')
      return bcoin.primitives.Coin.fromTX(bcoinTX, utxo.index, height)
    })

    await mtx.fund(coins, {
      selection: 'age',
      round: false,
      changeAddress: this.getChangeAddress(),
      subtractFee: subtractFee,
      height: height,
      rate: rate,
      maxFee: maxFee,
      estimate: prev => this.estimateSize(prev)
    })

    // If TX is RBF mark is by changing the Inputs sequences
    if (setRBF) {
      for (const input of mtx.inputs) {
        input.sequence = RBF_SEQUENCE_NUM
      }
    }

    // Check consensus rules for fees and outputs
    if (!mtx.isSane()) {
      throw new Error('TX failed sanity check.')
    }

    // Check consensus rules for inputs
    if (!mtx.verifyInputs(height)) {
      throw new Error('TX failed context check.')
    }

    return mtx
  }

  async sign (mtx: any) {
    if (!this.keys.master.privKey && this.seed === '') {
      throw new Error("Can't sign without private key")
    }
    if (!this.keys.master.privKey) {
      this.keys.master.privKey = await this.getPrivateFromSeed(this.seed)
      this.saveKeysToCache()
    }
    const keys = []
    for (const input: any of mtx.inputs) {
      const { prevout } = input
      if (prevout) {
        const [branch: number, index: number] = this.utxoToPath(prevout)
        const keyRing = branch === 0 ? this.keys.receive : this.keys.change
        let { privKey } = keyRing
        if (!privKey) {
          keyRing.privKey = this.keys.master.privKey.derive(branch)
          privKey = keyRing.privKey
          this.saveKeysToCache()
        }
        const privateKey = privKey.derive(index).privateKey
        const nested = this.bip === 'bip49'
        const witness = this.bip === 'bip49'
        const key = bcoin.primitives.KeyRing.fromOptions({
          privateKey,
          nested,
          witness
        })
        key.network = bcoin.network.get(this.network)
        keys.push(key)
      }
    }
    await mtx.template(keys)
    if (this.network.includes('bitcoincash')) {
      mtx.sign(keys, -100)
    } else mtx.sign(keys)
  }

  // ////////////////////////////////////////////// //
  // ////////////// Private API /////////////////// //
  // ////////////////////////////////////////////// //

  utxoToPath (prevout: any): Array<number> {
    let scriptHashForUtxo = null
    let branch: number = 0
    let index: number = 0
    for (const scriptHash: string in this.addressCache) {
      const addressObj: AddressObj = this.addressCache[scriptHash]
      if (!addressObj) throw new Error('Address is not part of this wallet')
      const utxos: Array<UtxoObj> = addressObj.utxos

      if (
        utxos.find((utxo: UtxoObj) => {
          return utxo.txid === prevout.rhash() && prevout.index === utxo.index
        })
      ) {
        scriptHashForUtxo = scriptHash
        break
      }
    }
    if (scriptHashForUtxo) {
      const findByScriptHash = (key: Key) =>
        key.scriptHash === scriptHashForUtxo
      let key: any = null
      key = this.keys.receive.children.find(findByScriptHash)
      if (!key) {
        key = this.keys.change.children.find(findByScriptHash)
        branch = 1
      }
      if (!key) throw new Error('Address is not part of this wallet')
      index = key.index
    }
    return [branch, index]
  }

  scriptHashToKey (scriptHash: string): ?Key {
    for (const branch: string in this.keys) {
      for (const keyForBranch: Key of this.keys[branch].children) {
        if (keyForBranch.scriptHash === scriptHash) {
          return keyForBranch
        }
      }
    }
    return null
  }

  addressToKey (address: string): ?Key {
    for (const branch: string in this.keys) {
      for (const keyForBranch: Key of this.keys[branch].children) {
        if (keyForBranch.displayAddress === address) {
          return keyForBranch
        }
      }
    }
    return null
  }

  getNextAvailable (keys: Array<Key>): string {
    let key = null
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].state === UNUSED) {
        key = keys[i]
        break
      }
    }
    if (!key) {
      for (let i = 0; i < keys.length; i++) {
        if (keys[i].state === LEASED) {
          key = keys[i]
          break
        }
      }
    }
    if (!key) return ''
    key.state = LEASED
    return key.displayAddress
  }

  async getPrivateFromSeed (seed: string) {
    let privateKey
    try {
      const mnemonic = bcoin.hd.Mnemonic.fromPhrase(seed)
      privateKey = bcoin.hd.PrivateKey.fromMnemonic(mnemonic, this.network)
    } catch (e) {
      const keyBuffer = Buffer.from(seed, 'base64')
      privateKey = bcoin.hd.PrivateKey.fromSeed(keyBuffer, this.network)
    }
    return privateKey
  }

  saveKeysToCache () {
    try {
      const keys = {}
      for (const type in this.keys) {
        keys[type] = {}
        if (this.keys[type].privKey) {
          keys[type].xpriv = this.keys[type].privKey.toBase58(this.network)
        }
        if (this.keys[type].pubKey) {
          keys[type].xpub = this.keys[type].pubKey.toBase58(this.network)
        }
      }
      this.onNewKey(keys)
    } catch (e) {
      console.log(e)
    }
  }

  async setLookAhead () {
    if (this.bip !== 'bip32') {
      const newKey = await this.deriveNewKeys(this.keys.change, 1)
      if (newKey) await this.setLookAhead()
    }
    const newKey = await this.deriveNewKeys(this.keys.receive, 0)
    if (newKey) await this.setLookAhead()
  }

  async deriveNewKeys (keyRing: KeyRing, branch: number) {
    let newPubKey = null
    let { pubKey } = keyRing
    const { children } = keyRing
    if (!pubKey) {
      keyRing.pubKey = this.keys.master.pubKey.derive(branch)
      pubKey = keyRing.pubKey
      this.saveKeysToCache()
    }
    if (children.length < this.gapLimit) {
      newPubKey = pubKey.derive(children.length)
    } else {
      for (let i = 0; i < children.length; i++) {
        if (
          children[i].state === USED &&
          children.length - i <= this.gapLimit
        ) {
          newPubKey = pubKey.derive(children.length)
          break
        }
      }
    }
    if (newPubKey) {
      const index = children.length
      let nested = false
      let witness = false
      if (this.bip === 'bip49') {
        nested = true
        witness = true
      }
      const key = bcoin.primitives.KeyRing.fromOptions({
        publicKey: newPubKey,
        nested,
        witness
      })
      key.network = bcoin.network.get(this.network)
      const address = key.getAddress('base58')
      const scriptHash = await this.addressToScriptHash(address)
      this.onNewAddress(
        scriptHash,
        address,
        `${this.masterPath}/${branch}/${index}`
      )
      children.push({
        state: UNUSED,
        displayAddress: address,
        scriptHash: scriptHash,
        index: index
      })
    }
    return newPubKey
  }

  async addressToScriptHash (address: string) {
    const scriptRaw = bcoin.script.fromAddress(address).toRaw()
    const scriptHashRaw = await this.hash256(scriptRaw)
    // $FlowFixMe
    const scriptHash = scriptHashRaw
      .toString('hex')
      .match(/../g)
      .reverse()
      .join('')
    return scriptHash
  }

  estimateSize (prev: any) {
    const scale = bcoin.consensus.WITNESS_SCALE_FACTOR
    const address = prev.getAddress()
    if (!address) return -1

    let size = 0

    if (prev.isScripthash()) {
      if (this.bip === 'bip49') {
        size += 23 // redeem script
        size *= 4 // vsize
        // Varint witness items length.
        size += 1
        // Calculate vsize
        size = ((size + scale - 1) / scale) | 0
      }
    }

    if (this.bip !== 'bip49') {
      // P2PKH
      // OP_PUSHDATA0 [signature]
      size += 1 + 73
      // OP_PUSHDATA0 [key]
      size += 1 + 33
      // size of input script.
      size += this.sizeVarint(size)
    }

    return size
  }

  sizeVarint (num: number) {
    if (num < 0xfd) return 1
    if (num <= 0xffff) return 3
    if (num <= 0xffffffff) return 5
    return 9
  }

  async hash160 (hex: any) {
    return Promise.resolve(
      crypto
        .createHash('ripemd160')
        .update(await this.hash256(hex))
        .digest()
    )
  }

  async hash256 (hex: any) {
    return Promise.resolve(
      crypto
        .createHash('sha256')
        .update(hex)
        .digest()
    )
  }
}
