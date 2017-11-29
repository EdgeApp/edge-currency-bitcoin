// @flow
import type { AbcWalletInfo } from 'airbitz-core-types'
import type { UtxoObj, EngineState, AddressObj } from './engine-state.js'
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

type Key = {
  state: number,
  displayAddress: string,
  scriptHash: string,
  index: number
}

type KeyRing = {
  pubKey: any,
  privKey: any,
  children: Array<Key>
}

export class KeyManager {
  bip: string
  masterPath: string
  currencyName: string
  network: string
  masterKeys: any
  engineState: EngineState
  gapLimit: number
  keys: {
    receive: KeyRing,
    change: KeyRing
  }

  constructor (
    keyInfo: AbcWalletInfo,
    engineState: EngineState,
    gapLimit: number,
    network: string
  ) {
    if (!keyInfo.keys) throw new Error('Missing Master Key')

    const walletType = keyInfo.type
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

    this.network = network
    this.masterKeys = keyInfo.keys
    this.masterKeys.masterPrivate = keyInfo.keys[`${this.network}Key`]
    this.masterKeys.masterPublic = keyInfo.keys[`${this.network}Xpub`]

    if (!this.masterKeys.masterPublic && !this.masterKeys.masterPrivate) {
      throw new Error('Missing Master Key')
    }

    this.engineState = engineState
    this.gapLimit = gapLimit || GAP_LIMIT
    this.keys = {
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

    for (const scriptHash in this.engineState.addressCache) {
      const address: AddressObj = this.engineState.addressCache[scriptHash]
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
    this.keys.receive.children.sort(
      (a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0)
    )
    this.keys.change.children.sort(
      (a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0)
    )
  }

  // ////////////////////////////////////////////// //
  // /////////////// Public API /////////////////// //
  // ////////////////////////////////////////////// //
  async load () {
    if (this.masterKeys.masterPrivate) {
      this.masterKeys.masterPrivate = await this.getPrivateFromSeed(
        this.masterKeys.masterPrivate
      )
      this.masterKeys.masterPublic = this.masterKeys.masterPrivate.toPublic()
    } else {
      this.masterKeys.masterPublic = bcoin.hd.PublicKey.fromBase58(
        this.masterKeys.masterPublic,
        this.network
      )
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

  async createTX (
    spendTargets: Array<any>,
    utxos: Array<UtxoObj>,
    blockHeight: number,
    rate: number,
    maxFee?: number
  ): any {
    if (spendTargets.length === 0) throw new Error('No outputs available.')
    const mtx = new bcoin.primitives.MTX()

    // Add the outputs
    for (const spendTarget of spendTargets) {
      const value = parseInt(spendTarget.nativeAmount)
      const script = bcoin.script.fromAddress(spendTarget.publicAddress)
      mtx.addOutput(script, value)
    }

    const coins = utxos.map(utxo => {
      const rawTx = this.engineState.txCache[utxo.txid]
      const bcoinTX = bcoin.primitives.TX.fromRaw(rawTx, 'hex')
      const bcoinTXJSON = bcoinTX.getJSON(this.network)
      const height = this.engineState.txHeightCache[utxo.txid].height
      const script = bcoin.script.fromRaw(bcoinTXJSON.outputs[utxo.index].script, 'hex')
      let coinbase = false
      if (!bcoinTXJSON.inputs ||
          !bcoinTXJSON.inputs.length
      ) {
        coinbase = true
      }

      return new bcoin.primitives.Coin({
        version: bcoinTXJSON.version,
        height: height,
        value: utxo.value,
        script: script,
        coinbase: coinbase,
        hash: utxo.txid,
        index: utxo.index
      })
    })

    await mtx.fund(coins, {
      selection: 'age',
      round: true,
      changeAddress: this.getChangeAddress(),
      height: blockHeight,
      rate: rate,
      maxFee: maxFee,
      estimate: prev => this.estimateSize(prev)
    })

    return mtx
  }

  async sign (mtx: any) {
    if (!this.masterKeys.masterPrivate) {
      throw new Error("Can't sign without private key")
    }
    if (typeof this.masterKeys.masterPrivate === 'string') {
      this.masterKeys.masterPrivate = await this.getPrivateFromSeed(
        this.masterKeys.masterPrivate
      )
    }
    const keys = []
    for (const input: any of mtx.inputs) {
      const { script, prevout } = input
      if (prevout) {
        const [branch: number, index: number] = this.utxoToPath(prevout.hash)
        const privKey = this.deriveKey(
          branch,
          index,
          this.masterKeys.masterPrivate
        )
        const key = bcoin.primitives.KeyRing.fromScript(
          privKey,
          script,
          this.network
        )
        keys.push(key)
      }
    }
    mtx.sign(keys)
  }

  // ////////////////////////////////////////////// //
  // ////////////// Private API /////////////////// //
  // ////////////////////////////////////////////// //

  utxoToPath (txid: string): Array<number> {
    let scriptHashForUtxo = null
    let branch: number = 0
    let index: number = 0
    for (const scriptHash: string in this.engineState.addressCache) {
      const addressObj: AddressObj = this.engineState.addressCache[scriptHash]
      if (!addressObj) throw new Error('Address is not part of this wallet')
      const utxos: Array<UtxoObj> = addressObj.utxos

      if (utxos.find((utxo: UtxoObj) => utxo.txid === txid)) {
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
    return privateKey.derivePath(this.masterPath)
  }

  async setLookAhead () {
    if (this.bip !== 'bip32') {
      const newKey = await this.deriveNewKeys(this.keys.change, 1)
      if (newKey) await this.setLookAhead()
    }
    const newKey = await this.deriveNewKeys(this.keys.receive, 0)
    if (newKey) await this.setLookAhead()
  }

  deriveKey (branch: number, index?: number, key?: any) {
    if (typeof index !== 'number' && !key) {
      key = index
      index = 0
    }
    key = key || this.masterKeys.masterPublic
    key = key.derive(branch)
    return index ? key.derive(index) : key
  }

  async deriveNewKeys (keyRing: KeyRing, branch: number) {
    let newPubKey = null
    let { pubKey } = keyRing
    const { children } = keyRing
    if (!pubKey) {
      keyRing.pubKey = this.deriveKey(branch)
      pubKey = keyRing.pubKey
    }
    if (children.length < this.gapLimit) {
      newPubKey = this.deriveKey(children.length, pubKey)
    } else {
      for (let i = 0; i < children.length; i++) {
        if (
          children[i].state === USED &&
          children.length - i <= this.gapLimit
        ) {
          newPubKey = this.deriveKey(children.length, pubKey)
          break
        }
      }
    }
    if (newPubKey) {
      const index = children.length
      const pubKeyHash = await this.hash160(newPubKey.publicKey)
      let address = null
      if (this.bip === 'bip49') {
        address = bcoin.primitives.Address.fromScripthash(
          pubKeyHash,
          this.network
        ).toBase58(this.network)
      } else {
        address = bcoin.primitives.Address.fromPubkeyhash(
          pubKeyHash,
          this.network
        ).toBase58(this.network)
      }
      const scriptHash = await this.addressToScriptHash(address)
      this.engineState.addAddress(
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
