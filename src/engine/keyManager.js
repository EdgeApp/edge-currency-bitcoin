// @flow
import type { AbcWalletInfo } from 'airbitz-core-types'
import type { EngineState } from './engine-state.js'

// $FlowFixMe
const BufferJS = require('bufferPlaceHolder').Buffer
const bcoin = require('bcoin')
const crypto = require('crypto')

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
  pubPriv: any,
  children: Array<Key>
}

export class KeyMananger {
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
    gapLimit: number
  ) {
    if (!keyInfo.keys) throw new Error('Missing Master Key')

    const walletType = keyInfo.type
    const bip = walletType.split('-')[1]
    this.bip = bip && bip.includes('bip') ? bip : 'bip32'
    this.masterPath = ''
    switch (bip) {
      case 'bip32':
        this.masterPath = 'm/0'
        break
      case 'bip44':
        this.masterPath = "m/44'/0'/0'"
        break
      case 'bip49':
        this.masterPath = "m/49'/0'/0'"
        break
    }
    this.currencyName = walletType
      .split(':')[1]
      .split('-')[0]
      .toLowerCase()
    this.network = walletType.includes('testnet') ? 'testnet' : 'main'

    this.masterKeys = keyInfo.keys
    this.masterKeys.masterPrivate = keyInfo.keys[`${this.currencyName}Key`]
    this.masterKeys.masterPublic = keyInfo.keys[`${this.currencyName}Xpub`]

    if (!this.masterKeys.masterPublic && !this.masterKeys.masterPrivate) {
      throw new Error('Missing Master Key')
    }

    if (!this.masterKeys.masterPublic) {
      this.masterKeys.masterPrivate = this.getPrivateFromSeed(
        this.masterKeys.masterPrivate
      )
    } else {
      this.masterKeys.masterPublic = bcoin.hd.PublicKey.fromBase58(
        this.masterKeys.masterPublic,
        this.network
      )
    }

    this.engineState = engineState

    this.gapLimit = gapLimit || GAP_LIMIT
    this.keys = {
      receive: {
        pubKey: null,
        pubPriv: null,
        children: []
      },
      change: {
        pubKey: null,
        pubPriv: null,
        children: []
      }
    }

    for (const scriptHash in this.engineState.addressCache) {
      const address = this.engineState.addressCache[scriptHash]
      const { txids, displayAddress, path } = address
      const [branch, index] = path.split(this.masterPath)[1].split('/')
      const state = txids && txids.length > 0 ? USED : UNUSED
      const key = { state, displayAddress, scriptHash, index: parseInt(index) }
      if (branch) {
        this.keys.receive.children.push(key)
      } else {
        this.keys.change.children.push(key)
      }
    }
    this.keys.receive.children.sort(
      (a, b) => (a.index > b.index ? -1 : a.index < b.index ? 1 : 0)
    )
    this.keys.change.children.sort(
      (a, b) => (a.index > b.index ? -1 : a.index < b.index ? 1 : 0)
    )
    this.setLookAhead()
  }

  // ////////////////////////////////////////////// //
  // /////////////// Public API /////////////////// //
  // ////////////////////////////////////////////// //

  getReceiveAddress () {
    return this.getNextAvailable(this.keys.receive.children)
  }

  getChangeAddress () {
    if (this.bip === 'bip32') return this.getReceiveAddress()
    return this.getNextAvailable(this.keys.change.children)
  }

  use (scriptHash: string) {
    const address: any = this.scriptHashToAddress(scriptHash)
    address.state = USED
    this.setLookAhead()
  }

  unuse (scriptHash: string) {
    const address: any = this.scriptHashToAddress(scriptHash)
    address.state = UNUSED
    this.setLookAhead()
  }

  lease (scriptHash: string) {
    const address: any = this.scriptHashToAddress(scriptHash)
    address.state = LEASED
    this.setLookAhead()
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

  async createTX (
    spendTargets: Array<any>,
    blockHeight: number,
    rate: number,
    maxFee?: number
  ) {
    if (spendTargets.length === 0) throw new Error('No outputs available.')
    const mtx = new bcoin.primitives.MTX()

    // Add the outputs
    for (const spendTarget of spendTargets) {
      const value = parseInt(spendTarget.nativeAmount)
      const script = bcoin.script.fromAddress(spendTarget.publicAddress)
      mtx.addOutput(script, value)
    }

    let utxos = []
    for (const scriptHash in this.engineState.addressCache) {
      const addressUtxos = this.engineState.addressCache[scriptHash].utxos
      if (addressUtxos.length > 0) {
        utxos = utxos.concat(addressUtxos)
      }
    }

    const coins = utxos.map(utxo => {
      const rawTx = this.engineState.txCache[utxo.txid]
      const bcoinTX = bcoin.primitives.TX.fromRaw(BufferJS.from(rawTx, 'hex'))
      const bcoinTXJSON = bcoinTX.getJSON(this.network)

      return new bcoin.primitives.Coin({
        version: bcoinTXJSON.version,
        height: bcoinTXJSON.height, // TODO, get real height
        value: utxo.value,
        script: bcoinTXJSON.inputs[utxo.index].script,
        coinbase: !!bcoinTXJSON.inputs[utxo.index].prevout,
        hash: utxo.txid,
        index: utxo.index
      })
    })

    await mtx.fund(coins, {
      selection: 'age',
      round: true,
      changeAddress: this.getChangeAddress().displayAddress,
      height: blockHeight,
      rate: rate,
      maxFee: maxFee,
      estimate: prev => this.estimateSize(prev)
    })

    return mtx
  }

  sign (tx: any) {}

  // ////////////////////////////////////////////// //
  // ////////////// Private API /////////////////// //
  // ////////////////////////////////////////////// //

  scriptHashToAddress (scriptHash: string) {
    for (const branch in this.keys) {
      for (const address of this.keys[branch]) {
        if (address.scriptHash === scriptHash) {
          return address
        }
      }
    }
    return null
  }

  getNextAvailable (keys: Array<Key>) {
    let key = null
    for (let i = keys.length - 1; i >= 0; i++) {
      if (keys[i].state === UNUSED) {
        key = keys[i]
        break
      }
    }
    if (!key) {
      for (let i = keys.length - 1; i >= 0; i++) {
        if (keys[i].state === LEASED) {
          key = keys[i]
          break
        }
      }
    }
    if (!key) {
      this.setLookAhead()
      return this.getNextAvailable(keys)
    }

    key.state = LEASED
    this.setLookAhead()
    return key
  }

  getPrivateFromSeed (seed: string) {
    let privateKey
    try {
      const mnemonic = bcoin.hd.Mnemonic.fromPhrase(seed)
      privateKey = bcoin.hd.PrivateKey.fromMnemonic(
        mnemonic,
        this.network
      ).toPublic()
    } catch (e) {
      const keyBuffer = BufferJS.from(seed, 'base64')
      privateKey = bcoin.hd.PrivateKey.fromSeed(keyBuffer, this.network)
    }
    return privateKey.derivePath(this.masterPath)
  }

  setLookAhead () {
    if (this.bip !== 'bip32') {
      if (this.deriveNewKeys(this.keys.change, 0)) this.setLookAhead()
    }
    if (this.deriveNewKeys(this.keys.receive, 1)) this.setLookAhead()
  }

  deriveNewKeys (keyRing: KeyRing, branch: number) {
    let newPubKey = null
    let index = 0
    const { children, pubKey } = keyRing
    if (!pubKey) {
      keyRing.pubKey = this.deriveKey(branch)
    }
    // deriveNewKeys
    if (!children.length) {
      newPubKey = this.deriveKey(0, keyRing.pubKey)
    } else {
      for (let i = 0; i < children.length; i++) {
        if (children[i].state === USED && i < this.gapLimit) {
          index = children.length
          newPubKey = this.deriveKey(index, keyRing.pubKey)
          break
        }
      }
    }
    if (newPubKey) {
      let hash = ''
      let type = 'pubkeyhash'
      let version = -1
      if (this.bip === 'bip49') {
        hash = '' // TODO
        type = 'scripthash'
        version = 1
      } else {
        hash = '' // TODO
      }
      const address = bcoin.primities.Address.fromHash(
        hash,
        type,
        version,
        this.network
      )
      const scriptHash = this.addressToScriptHash(address)
      this.engineState.addAddress(
        scriptHash,
        address,
        `${this.masterPath}/${branch}/${index}`
      )
      children.unshift({
        state: UNUSED,
        displayAddress: address,
        scriptHash: scriptHash,
        index: index
      })
    }
    return newPubKey
  }

  addressToScriptHash (address: string) {
    const script = bcoin.script.fromAddress(address)
    const scriptRaw = script.toRaw()
    const scriptHash = crypto
      .createHash('sha256')
      .update(scriptRaw)
      .digest()
      .toString('hex')
    // $FlowFixMe
    const reversedScriptHash = scriptHash
      .match(/../g)
      .reverse()
      .join('')
    return reversedScriptHash
  }

  async estimateSize (prev: any) {
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
}
