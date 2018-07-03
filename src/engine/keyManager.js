// @flow
import type { AddressInfo, AddressInfos } from './engineState.js'
import type { Utxo, BlockHeight, TxOptions, Output } from '../utils/coinUtils.js'
import bcoin from 'bcoin'
import {
  addressToScriptHash,
  parsePath,
  getPrivateFromSeed,
  createTX
} from '../utils/coinUtils.js'
import {
  toLegacyFormat,
  toNewFormat
} from '../utils/addressFormat/addressFormatIndex.js'

const GAP_LIMIT = 10
const nop = () => {}

export type WalletType = string
export type RawTx = string

export type Address = {
  displayAddress: string,
  scriptHash: string,
  index: number,
  branch: number
}

export type KeyRing = {
  pubKey: any,
  privKey: any,
  children: Array<Address>
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
  outputs?: Array<Output>,
  utxos: Array<Utxo>,
  height: BlockHeight,
  rate: number,
  maxFee: number,
  txOptions: TxOptions
}

export interface KeyManagerCallbacks {
  // When deriving new address send it to caching and subscribing
  +onNewAddress?: (scriptHash: string, address: string, path: string) => void;
  // When deriving new key send it to caching
  +onNewKey?: (keys: any) => void;
}

export type KeyManagerOptions = {
  account?: number,
  bip?: string,
  coinType?: number,
  rawKeys?: RawKeys,
  seed?: string,
  gapLimit: number,
  network: string,
  callbacks: KeyManagerCallbacks,
  addressInfos?: AddressInfos,
  txInfos?: { [txid: string]: any }
}

export class KeyManager {
  masterPath: string
  currencyName: string
  writeLock: any
  bip: string
  keys: Keys
  seed: string
  gapLimit: number
  network: string
  onNewAddress: (scriptHash: string, address: string, path: string) => void
  onNewKey: (keys: any) => void
  addressInfos: AddressInfos
  txInfos: { [txid: string]: any }

  constructor ({
    account = 0,
    bip = 'bip32',
    coinType = -1,
    rawKeys = {},
    seed = '',
    gapLimit = GAP_LIMIT,
    network,
    callbacks,
    addressInfos = {},
    txInfos = {}
  }: KeyManagerOptions) {
    // Check for any way to init the wallet with either a seed or master keys
    if (
      seed === '' &&
      (!rawKeys.master || (!rawKeys.master.xpriv && !rawKeys.master.xpub))
    ) {
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
    // Create Locks
    this.writeLock = new bcoin.utils.Lock()

    // Try to load as many pubKey/privKey as possible from the cache
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
    this.bip = bip
    if (coinType < 0) {
      coinType = bcoin.network.get(this.network).keyPrefix.coinType
    }
    switch (this.bip) {
      case 'bip32':
        this.masterPath = 'm/0'
        break
      case 'bip44':
        this.masterPath = `m/44'/${coinType}'/${account}'`
        break
      case 'bip49':
        this.masterPath = `m/49'/${coinType}'/${account}'`
        break
      default:
        throw new Error('Unknown bip type')
    }

    // Setup gapLimit
    this.gapLimit = gapLimit

    // Set the callbacks with nops as default
    const { onNewAddress = nop, onNewKey = nop } = callbacks
    this.onNewAddress = onNewAddress
    this.onNewKey = onNewKey
    this.addressInfos = addressInfos
    this.txInfos = txInfos

    // Load addresses from Cache
    for (const scriptHash in addressInfos) {
      const addressObj: AddressInfo = addressInfos[scriptHash]
      const path = parsePath(addressObj.path, this.masterPath)
      if (path.length) {
        const [branch, index] = path
        const displayAddress = toNewFormat(addressObj.displayAddress, network)
        const address = { displayAddress, scriptHash, index, branch }
        if (branch === 0) {
          this.keys.receive.children.push(address)
        } else {
          this.keys.change.children.push(address)
        }
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
    // If we don't have a public master key we will now create it from seed
    if (!this.keys.master.pubKey) await this.initMasterKeys()
    await this.setLookAhead(true)
  }

  async reload () {
    for (const branch in this.keys) {
      this.keys[branch].children = []
    }
    await this.load()
  }

  getReceiveAddress (): string {
    return this.getNextAvailable(this.keys.receive.children)
  }

  getChangeAddress (): string {
    if (this.bip === 'bip32') return this.getReceiveAddress()
    return this.getNextAvailable(this.keys.change.children)
  }

  async createTX (options: createTxOptions): any {
    // Get the Change Address
    const changeAddress = toLegacyFormat(this.getChangeAddress(), this.network)
    // Create our custom estimate function
    const estimate = prev => this.estimateSize(prev)
    // Create the transaction by merging options with changeAddress & estimate
    return createTX({ ...options, changeAddress, estimate })
  }

  async sign (mtx: any, privateKeys: Array<string> = []) {
    const keyRings = []
    for (const key of privateKeys) {
      const privKey = await bcoin.primitives.KeyRing.fromSecret(key, this.network)
      keyRings.push(privKey)
    }
    if (!keyRings.length) {
      if (!this.keys.master.privKey && this.seed === '') {
        throw new Error("Can't sign without private key")
      }
      await this.initMasterKeys()
      for (const input: any of mtx.inputs) {
        const { prevout } = input
        if (prevout) {
          const [branch: number, index: number] = this.utxoToPath(prevout)
          const keyRing = branch === 0 ? this.keys.receive : this.keys.change
          if (!keyRing.privKey) {
            keyRing.privKey = await this.keys.master.privKey.derive(branch)
            this.saveKeysToCache()
          }
          const result = keyRing.privKey.derive(index)
          let privateKey
          if (typeof result.then === 'function') {
            privateKey = await Promise.resolve(result)
          } else {
            privateKey = result
          }
          const nested = this.bip === 'bip49'
          const witness = this.bip === 'bip49'
          const key = bcoin.primitives.KeyRing.fromOptions({
            privateKey,
            nested,
            witness
          })
          key.network = bcoin.network.get(this.network)
          keyRings.push(key)
        }
      }
    }
    await mtx.template(keyRings)
    mtx.sign(keyRings, bcoin.networks[this.network].replayProtaction)
  }

  getSeed (): string | null {
    if (this.seed && this.seed !== '') {
      if (this.bip !== 'bip32') return this.seed
      try {
        const keyBuffer = Buffer.from(this.seed, 'base64')
        return keyBuffer.toString('hex')
      } catch (e) {
        console.log(e)
        return null
      }
    }
    return null
  }

  getPublicSeed (): string | null {
    return this.keys.master.pubKey
      ? this.keys.master.pubKey.toBase58(this.network)
      : null
  }

  // ////////////////////////////////////////////// //
  // ////////////// Private API /////////////////// //
  // ////////////////////////////////////////////// //

  utxoToPath (prevout: any): Array<number> {
    const parsedTx = this.txInfos[prevout.rhash()]
    if (!parsedTx) throw new Error('UTXO not synced yet')
    const output = parsedTx.outputs[prevout.index]
    if (!output) throw new Error('Corrupt UTXO or output list')
    const scriptHash = output.scriptHash
    const address = this.addressInfos[scriptHash]
    if (!address) throw new Error('Address is not part of this wallet')
    const path = address.path
    const pathSuffix = path.split(this.masterPath + '/')[1]
    const [branch, index] = pathSuffix.split('/')
    return [parseInt(branch), parseInt(index)]
  }

  getNextAvailable (addresses: Array<Address>): string {
    let key = null
    for (let i = 0; i < addresses.length; i++) {
      const scriptHash = addresses[i].scriptHash
      if (
        this.addressInfos[scriptHash] &&
        !this.addressInfos[scriptHash].used
      ) {
        key = addresses[i]
        break
      }
    }
    return key
      ? key.displayAddress
      : addresses[addresses.length - 1].displayAddress
  }

  async initMasterKeys () {
    if (this.keys.master.privKey) {
      this.keys.master.pubKey = this.keys.master.privKey.toPublic()
    } else {
      const privateKey = await getPrivateFromSeed(this.seed, this.network)
      const privKey = await privateKey.derivePath(this.masterPath)
      const pubKey = privKey.toPublic()
      this.keys.master = { ...this.keys.master, privKey, pubKey }
    }
    this.saveKeysToCache()
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

  async setLookAhead (closeGaps: boolean = false) {
    const unlock = await this.writeLock.lock()
    try {
      if (this.bip !== 'bip32') {
        await this.deriveNewKeys(this.keys.change, 1, closeGaps)
      }
      await this.deriveNewKeys(this.keys.receive, 0, closeGaps)
    } catch (e) {
      console.log(e)
    } finally {
      unlock()
    }
  }

  async deriveNewKeys (keyRing: KeyRing, branch: number, closeGaps: boolean) {
    const { children } = keyRing
    // If we never derived a public key for this branch before
    if (!keyRing.pubKey) {
      keyRing.pubKey = await this.keys.master.pubKey.derive(branch)
      this.saveKeysToCache()
    }

    // If the chain might have gaps, fill those in:
    if (closeGaps) {
      let index = 0
      const length = children.length
      for (let i = 0; i < length; ++i, ++index) {
        while (index < children[i].index) {
          await this.deriveAddress(keyRing, branch, index++)
        }
      }
      if (children.length > length) {
        // New addresses get appended, so sort them back into position:
        children.sort((a, b) => a.index - b.index)
      }
    }

    // Find the last used address:
    let lastUsed =
      children.length < this.gapLimit ? 0 : children.length - this.gapLimit
    for (let i = lastUsed; i < children.length; ++i) {
      const scriptHash = children[i].scriptHash
      if (this.addressInfos[scriptHash] && this.addressInfos[scriptHash].used) {
        lastUsed = i
      }
    }

    // If the last used address is too close to the end, generate some more:
    while (lastUsed + this.gapLimit > children.length) {
      await this.deriveAddress(keyRing, branch, children.length)
    }
  }

  /**
   * Derives an address at the specified branch and index,
   * and adds it to the state.
   * @param keyRing The KeyRing corresponding to the selected branch.
   */
  async deriveAddress (keyRing: KeyRing, branch: number, index: number) {
    if (!keyRing.pubKey) {
      const result = this.keys.master.pubKey.derive(branch)
      if (typeof result.then === 'function') {
        keyRing.pubKey = await Promise.resolve(result)
      } else {
        keyRing.pubKey = result
      }
      this.saveKeysToCache()
    }
    let publicKey

    const result = keyRing.pubKey.derive(index)
    if (typeof result.then === 'function') {
      publicKey = await Promise.resolve(result)
    } else {
      publicKey = result
    }

    let nested = false
    let witness = false
    if (this.bip === 'bip49') {
      nested = true
      witness = true
    }
    const key = bcoin.primitives.KeyRing.fromOptions({
      publicKey,
      nested,
      witness
    })
    key.network = bcoin.network.get(this.network)
    let displayAddress = key.getAddress('base58')
    const scriptHash = await addressToScriptHash(displayAddress)
    displayAddress = toNewFormat(displayAddress, this.network)
    this.onNewAddress(
      scriptHash,
      displayAddress,
      `${this.masterPath}/${branch}/${index}`
    )
    const address = {
      displayAddress,
      scriptHash,
      index,
      branch
    }
    keyRing.children.push(address)
    return publicKey
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

    // P2PKH
    if (this.bip !== 'bip49') {
      // varint script size
      size += 1
      // OP_PUSHDATA0 [signature]
      size += 1 + 73
      // OP_PUSHDATA0 [key]
      size += 1 + 33
    }

    return size || -1
  }
}
