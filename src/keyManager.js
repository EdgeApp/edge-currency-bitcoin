// @flow
import type { AbcWalletInfo } from 'airbitz-core-types'
import type { EngineState } from './engineState.js'

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

  getReceive () {
    return this.getNextAvailable(this.keys.receive.children)
  }

  getChange () {
    return this.getNextAvailable(this.keys.change.children)
  }

  use (scriptHash: string) {
    for (const branch in this.keys) {
      let found = false
      for (const address of this.keys[branch]) {
        if (address.scriptHash === scriptHash) {
          address.state = USED
          found = true
          break
        }
      }
      if (found) break
    }
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

  // ////////////////////////////////////////////// //
  // ////////////// Private API /////////////////// //
  // ////////////////////////////////////////////// //

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

  // sign (tx) {

  // }
}
