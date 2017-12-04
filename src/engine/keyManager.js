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
  engineState: EngineState
  walletLocalEncryptedFolder: any
  gapLimit: number
  keys: {
    master: KeyRing,
    receive: KeyRing,
    change: KeyRing
  }

  constructor (
    keyInfo: AbcWalletInfo,
    engineState: EngineState,
    walletLocalEncryptedFolder: any,
    gapLimit: number,
    network: string
  ) {
    this.network = network
    if (!keyInfo.keys ||
      (!keyInfo.keys[`${this.network}Xpub`] && !keyInfo.keys[`${this.network}Key`])) {
      throw new Error('Missing Master Key')
    }
    this.keys = {
      master: {
        pubKey: keyInfo.keys[`${this.network}Xpub`],
        privKey: keyInfo.keys[`${this.network}Key`],
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
    this.walletLocalEncryptedFolder = walletLocalEncryptedFolder
    this.engineState = engineState
    this.gapLimit = gapLimit || GAP_LIMIT

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
    let privateKey = null

    // See if we have an xpriv key stored in local encrypted storage
    console.log('PTIMER START loadEncryptedFromDisk ' + Date.now())
    let keyObj = await this.loadEncryptedFromDisk()
    console.log('PTIMER END loadEncryptedFromDisk ' + Date.now())
    if (keyObj) {
      try {
        // bcoin says fromJSON but it's really from JS object
        console.log('PTIMER START fromJSON ' + Date.now())
        privateKey = bcoin.hd.PrivateKey.fromJSON(keyObj)
        console.log('PTIMER END fromJSON ' + Date.now())
      } catch (e) {
        console.log('PTIMER CATCH key=NULL ' + Date.now())
        privateKey = null
        keyObj = null
      }
    }

    if (!privateKey) {
      if (this.keys.master.privKey) {
        privateKey = await this.getPrivateFromSeed(
          this.keys.master.privKey
        )
      } else {
        this.keys.master.pubKey = bcoin.hd.PublicKey.fromBase58(
          this.keys.master.pubKey,
          this.network
        )
      }
    }

    if (privateKey) {
      this.keys.master.privKey = privateKey.derivePath(this.masterPath)
      this.keys.master.pubKey = this.keys.master.privKey.toPublic()
    }

    // If we didn't have a stored key AND do have a privateKey, store it now
    if (!keyObj && privateKey) {
      // bcoin says toJSON but it's really to JS object
      console.log('START key.toJSON ' + Date.now())
      keyObj = privateKey.toJSON()
      console.log('START saveEncryptedToDisk ' + Date.now())
      await this.saveEncryptedToDisk(keyObj)
      console.log('END saveEncryptedToDisk' + Date.now())
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
    utxos: Array<{
      utxo: UtxoObj,
      rawTx: string,
      height: number
    }>,
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

    const coins = utxos.map(({utxo, rawTx, height}) => {
      const bcoinTX = bcoin.primitives.TX.fromRaw(rawTx, 'hex')
      return bcoin.primitives.Coin.fromTX(bcoinTX, utxo.index, height)
    })

    await mtx.fund(coins, {
      selection: 'age',
      round: false,
      changeAddress: this.getChangeAddress(),
      height: blockHeight,
      rate: rate,
      maxFee: maxFee,
      estimate: prev => this.estimateSize(prev)
    })

    if (!mtx.isSane()) {
      throw new Error('TX failed sanity check.')
    }

    if (!mtx.verifyInputs(blockHeight)) {
      throw new Error('TX failed context check.')
    }
    return mtx
  }

  async sign (mtx: any) {
    if (!this.keys.master.privKey) {
      throw new Error("Can't sign without private key")
    }
    if (typeof this.keys.master.privKey === 'string') {
      this.keys.master.privKey = await this.getPrivateFromSeed(
        this.keys.master.privKey
      )
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
        }
        const privateKey = privKey.derive(index).privateKey
        const nested = (this.bip === 'bip49')
        const witness = (this.bip === 'bip49')
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
    for (const scriptHash: string in this.engineState.addressCache) {
      const addressObj: AddressObj = this.engineState.addressCache[scriptHash]
      if (!addressObj) throw new Error('Address is not part of this wallet')
      const utxos: Array<UtxoObj> = addressObj.utxos

      if (utxos.find((utxo: UtxoObj) => {
        return (utxo.txid === prevout.rhash() && prevout.index === utxo.index)
      })) {
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
      console.log('PTIMER START Mnemonic.fromPhrase ' + Date.now())
      const mnemonic = bcoin.hd.Mnemonic.fromPhrase(seed)
      console.log('PTIMER START PrivateKey.fromMnemonic ' + Date.now())
      privateKey = bcoin.hd.PrivateKey.fromMnemonic(mnemonic, this.network)
      console.log('PTIMER END PrivateKey.fromMnemonic ' + Date.now())
    } catch (e) {
      console.log('PTIMER CATCH Buffer.from(seed) ' + Date.now())
      const keyBuffer = Buffer.from(seed, 'base64')
      console.log('PTIMER END Buffer.from(seed) ' + Date.now())
      privateKey = bcoin.hd.PrivateKey.fromSeed(keyBuffer, this.network)
      console.log('PTIMER END PrivateKey.fromSeed ' + Date.now())
    }
    return privateKey
  }

  async setLookAhead () {
    if (this.bip !== 'bip32') {
      const newKey = await this.deriveNewKeys(this.keys.change, 1)
      if (newKey) await this.setLookAhead()
    }
    const newKey = await this.deriveNewKeys(this.keys.receive, 0)
    if (newKey) await this.setLookAhead()
  }

  async loadEncryptedFromDisk () {
    try {
      const data: string = await this.walletLocalEncryptedFolder.file('privateKey').getText()
      const dataObj = JSON.parse(data)
      return dataObj
    } catch (e) {
      return null
    }
  }

  async saveEncryptedToDisk (xprivObj: any) {
    try {
      const xprivJson = JSON.stringify(xprivObj)
      await this.walletLocalEncryptedFolder.file('privateKey').setText(xprivJson)
    } catch (e) {}
  }

  async deriveNewKeys (keyRing: KeyRing, branch: number) {
    let newPubKey = null
    let { pubKey } = keyRing
    const { children } = keyRing
    if (!pubKey) {
      keyRing.pubKey = this.keys.master.pubKey.derive(branch)
      pubKey = keyRing.pubKey
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
