// @flow
import type { AddressInfo, AddressInfos } from './engineState.js'
import type {
  Utxo,
  BlockHeight,
  TxOptions,
  Output
} from '../utils/coinUtils.js'
import { getAllKeyRings, FormatSelector } from '../utils/formatSelector.js'
import { parsePath, createTX, getLock } from '../utils/coinUtils.js'
import { toNewFormat } from '../utils/addressFormat/addressFormatIndex.js'

const GAP_LIMIT = 10
const nop = () => {}

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
  fSelector: any
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
    this.gapLimit = gapLimit
    this.network = network
    this.bip = bip
    this.fSelector = FormatSelector(bip, network)
    // Create a lock for when deriving addresses
    this.writeLock = getLock()
    // Create the master derivation path
    this.masterPath = this.fSelector.createMasterPath(account, coinType)
    // Set the callbacks with nops as default
    const { onNewAddress = nop, onNewKey = nop } = callbacks
    this.onNewAddress = onNewAddress
    this.onNewKey = onNewKey
    // Set the addresses and txs state objects
    this.addressInfos = addressInfos
    this.txInfos = txInfos
    // Create KeyRings while tring to load as many of the pubKey/privKey from the cache
    this.keys = this.fSelector.keysFromRaw(rawKeys)
    // Load addresses from Cache
    const { branches } = this.fSelector
    for (const scriptHash in addressInfos) {
      const addressObj: AddressInfo = addressInfos[scriptHash]
      const path = parsePath(addressObj.path, this.masterPath)
      if (path.length) {
        const [branch, index] = path
        const displayAddress = toNewFormat(addressObj.displayAddress, network)
        const address = { displayAddress, scriptHash, index, branch }
        this.keys[branches[branch]].children.push(address)
      }
    }
    // Cache is not sorted so sort addresses according to derivation index
    for (const branch in this.keys) {
      this.keys[branch].children.sort((a, b) => a.index - b.index)
    }
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
    return createTX({
      ...options,
      changeAddress: this.getChangeAddress(),
      estimate: prev => this.fSelector.estimateSize(prev),
      network: this.network
    })
  }

  async sign (tx: any, privateKeys: Array<string> = []) {
    const keyRings = await getAllKeyRings(privateKeys, this.network)
    if (!keyRings.length) {
      if (!this.keys.master.privKey && this.seed === '') {
        throw new Error("Can't sign without private key")
      }
      await this.initMasterKeys()
      const { branches } = this.fSelector
      for (const input: any of tx.inputs) {
        const { prevout } = input
        if (prevout) {
          const [branch: number, index: number] = this.utxoToPath(prevout)
          const keyRing = this.keys[branches[branch]]
          if (!keyRing.privKey) {
            keyRing.privKey = await this.fSelector.deriveHdKey(
              this.keys.master.privKey,
              branch
            )
            this.saveKeysToCache()
          }
          const key = await this.fSelector.deriveKeyRing(keyRing.privKey, index)
          keyRings.push(key)
        }
      }
    }
    return this.fSelector.sign(tx, keyRings)
  }

  getSeed (): string | null {
    if (this.seed && this.seed !== '') {
      try {
        return this.fSelector.parseSeed(this.seed)
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
    const keys = await this.fSelector.getMasterKeys(
      this.seed,
      this.masterPath,
      this.keys.master.privKey
    )
    this.keys.master = { ...this.keys.master, ...keys }
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
      const { branches } = this.fSelector
      for (let i = 0; i < branches.length; i++) {
        await this.deriveNewKeys(this.keys[branches[i]], i, closeGaps)
      }
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
      keyRing.pubKey = await this.fSelector.deriveHdKey(
        this.keys.master.pubKey,
        branch
      )
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
   * Derives an address at the specified branch and index from the keyRing,
   * and adds it to the state.
   * @param keyRing The KeyRing corresponding to the selected branch.
   */
  async deriveAddress (keyRing: KeyRing, branch: number, index: number) {
    const { address, scriptHash } = await this.fSelector.deriveAddress(
      keyRing.pubKey,
      index
    )
    const displayAddress = toNewFormat(address, this.network)
    const keyPath = `${this.masterPath}/${branch}/${index}`
    keyRing.children.push({ displayAddress, scriptHash, index, branch })
    this.onNewAddress(scriptHash, displayAddress, keyPath)
  }
}
