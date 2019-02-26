// @flow

import EventEmitter from 'eventemitter3'
import type { HDKeyPair, HDPath } from 'nidavellir'
import { HD, Utils } from 'nidavellir'

import type {
  Address as AddressObj,
  EdgeAddress,
  Script,
  ScriptHashMap,
  StandardOutput
} from '../../types/bcoinUtils.js'
import type {
  AddressInfos,
  KeyManagerOptions,
  SignMessage,
  createTxOptions
} from '../../types/engine.js'
import { toNewFormat } from '../utils/addressFormat/addressFormatIndex.js'
import * as Address from '../utils/bcoinUtils/address.js'
import * as Key from '../utils/bcoinUtils/key.js'
import * as Misc from '../utils/bcoinUtils/misc.js'
import * as Tx from '../utils/bcoinUtils/tx.js'

const { ExtendedKey, HDKey } = HD

const GAP_LIMIT = 10

export class KeyManager extends EventEmitter {
  writeLock: any
  masterKey: HDKeyPair
  scriptTemplates: any
  seed: string
  xpub: string
  gapLimit: number
  network: string
  account: number
  coinType: number

  addressInfos: AddressInfos
  hdPaths: Array<HDPath>
  scriptHashes: { [displayAddress: string]: string }
  scriptHashesMap: ScriptHashMap
  txInfos: { [txid: string]: any }

  constructor ({
    account = 0,
    coinType = 0,
    masterKey,
    seed = '',
    xpub = '',
    gapLimit = GAP_LIMIT,
    network,
    addressInfos = {},
    scriptHashes = {},
    scriptHashesMap = {},
    txInfos = {},
    bips = []
  }: KeyManagerOptions) {
    super()
    // Check for any way to init the wallet with either a seed or master keys
    if (!seed && !xpub && !masterKey) {
      throw new Error('Missing Master Key')
    }
    this.seed = seed
    this.xpub = xpub
    this.gapLimit = gapLimit
    this.network = network
    this.account = account
    this.coinType = coinType
    this.txInfos = txInfos
    // Get Settings for this network
    // TODO - Get custom scriptTemplates
    // const { scriptTemplates } = NetworkInfo.networks[network]
    this.hdPaths = HD.Paths.createPaths(bips, coinType, account, this.network)
    // this.scriptTemplates = scriptTemplates
    // Create a lock for when deriving addresses
    this.writeLock = Misc.getLock()
    // Load the master derivation key from cache
    if (masterKey) this.masterKey = masterKey
    // Set the addresses and txs state objects
    this.addressInfos = addressInfos
    // Helper map from display address to script hash
    this.scriptHashes = scriptHashes
    // Helper map from path to script hash
    this.scriptHashesMap = scriptHashesMap

    for (const hdPath of this.hdPaths) {
      const path = hdPath.path.join('/')
      if (!this.scriptHashesMap[path]) this.scriptHashesMap[path] = []
    }
  }

  // ////////////////////////////////////////////// //
  // /////////////// Public API /////////////////// //
  // ////////////////////////////////////////////// //
  async initMasterKey (forceInit: boolean = false) {
    if (!this.masterKey || !this.masterKey.privateKey || forceInit) {
      if (this.seed === '') throw new Error('Missing Master Key')
      const hexSeed = await Key.seedToHex(this.seed, this.network)
      this.masterKey = await HDKey.fromSeed(hexSeed, this.network)
    }
    this.masterKey = await HDKey.fromPaths(
      this.masterKey,
      this.hdPaths,
      this.network
    )
    // Fill up addresses to reach minimum gapLimit
    for (const path in this.scriptHashesMap) {
      const scriptHashes = this.scriptHashesMap[path]
      const amountToFill = this.gapLimit - scriptHashes.length
      if (amountToFill > 0) {
        let index = scriptHashes.length
        const endIndex = scriptHashes.length + amountToFill
        for (; index < endIndex; index++) {
          const newAddr = await this.deriveAddress(`${path}/${index}`)
          if (!newAddr) return
        }
      }
    }
    if (!this.xpub) {
      this.xpub = await HDKey.toString(this.masterKey, this.network, true)
    }
    this.emit('newKey', this.masterKey)
  }

  async deriveKey (path: string): Promise<HDKeyPair> {
    const pathArray = path.split('/')
    const index = pathArray.pop()

    let parentKey = HDKey.getKey(this.masterKey, pathArray)
    if (!parentKey) {
      this.masterKey = await HDKey.fromPath(
        this.masterKey,
        { path: pathArray },
        this.network
      )
      parentKey = HDKey.getKey(this.masterKey, pathArray)
    }

    if (!parentKey) throw new Error('Cannot get parent key')
    const key = await ExtendedKey.fromIndex(parentKey, index, this.network)

    const hdKey = HDKey.fromExtendedKey(key, parentKey)
    return hdKey
  }

  async load (forceLoad: boolean = false) {
    await this.initMasterKey(forceLoad)
    await this.setLookAhead()
  }

  async reload () {
    await this.load(true)
  }

  getReceiveAddress (): EdgeAddress {
    const addresses = {}
    for (const hdPath of this.hdPaths) {
      const { path, chain, scriptType = 'P2PKH' } = hdPath
      if (chain !== 'external') continue
      const scriptHashes = this.scriptHashesMap[path.join('/')]
      const scriptHash = scriptHashes[scriptHashes.length - 1]
      const { displayAddress } = this.addressInfos[scriptHash]
      addresses[scriptType] = displayAddress
    }
    return addresses
  }

  async createTX (options: createTxOptions): any {
    const { outputs = [], ...rest } = options
    const standardOutputs: Array<StandardOutput> = []
    for (const output of outputs) {
      const address = output.address
      if (address) standardOutputs.push({ address, value: output.value })
    }

    const hdPath = this.hdPaths.length > 1 ? this.hdPaths[1] : this.hdPaths[0]
    const { path, scriptType = 'P2PKH' } = hdPath
    const scriptHashes = this.scriptHashesMap[path.join('/')]
    const scriptHash = scriptHashes[scriptHashes.length - 1]
    const changeAddress = this.addressInfos[scriptHash].displayAddress

    return Tx.createTX({
      ...rest,
      outputs: standardOutputs,
      changeAddress,
      estimate: prev => Tx.estimateSize(scriptType, prev),
      network: this.network
    })
  }

  async sign (tx: any, privateKeys: Array<string> = []) {
    const keyRings = await Key.getAllKeyRings(privateKeys, this.network)
    if (!keyRings.length) {
      await this.initMasterKey()
      for (const input: any of tx.inputs) {
        const { prevout } = input
        if (prevout) {
          const { path, redeemScript } = this.utxoToAddress(prevout)
          const key = await this.deriveKey(path)
          if (key.privateKey) keyRings.push({ ...key, redeemScript })
        }
      }
    }
    return Tx.sign(tx, keyRings, this.network)
  }

  async signMessage ({ message, address }: SignMessage) {
    try {
      await this.initMasterKey()
      if (!address) throw new Error('Missing address to sign with')
      const scriptHash = this.scriptHashes[address]
      if (!scriptHash) throw new Error('Address is not part of this wallet')
      const addressInfo = this.addressInfos[scriptHash]
      if (!addressInfo) throw new Error('Address is not part of this wallet')
      const { path } = addressInfo
      const { privateKey, publicKey } = await this.deriveKey(path)
      if (!privateKey) {
        throw new Error('Key is not part of this wallet')
      }
      // sign.
      const signature = await Utils.Secp256k1.sign(message, privateKey)
      return { signature, publicKey }
    } catch (e) {
      console.log(e)
      throw e
    }
  }

  getSeed (): string | null {
    if (this.seed && this.seed !== '') {
      try {
        return Key.parseSeed(this.seed)
      } catch (e) {
        console.log(e)
      }
    }
    return null
  }

  getPublicSeed (): string | null {
    return this.xpub
  }

  // ////////////////////////////////////////////// //
  // ////////////// Private API /////////////////// //
  // ////////////////////////////////////////////// //

  utxoToAddress (prevout: any): { path: string, redeemScript?: string } {
    const parsedTx = this.txInfos[prevout.rhash()]
    if (!parsedTx) throw new Error('UTXO not synced yet')
    const output = parsedTx.outputs[prevout.index]
    if (!output) throw new Error('Corrupt UTXO or output list')
    const scriptHash = output.scriptHash
    const address = this.addressInfos[scriptHash]
    if (!address) throw new Error('Address is not part of this wallet')
    return address
  }

  async setLookAhead () {
    const unlock = await this.writeLock.lock()
    try {
      for (const path in this.scriptHashesMap) {
        await this.deriveNewKeys(path)
      }
    } catch (e) {
      console.log(e)
    } finally {
      unlock()
    }
  }

  async deriveNewKeys (path: string) {
    const hashes = this.scriptHashesMap[path]

    // Find the last used address:
    let lastUsed =
      hashes.length < this.gapLimit ? 0 : hashes.length - this.gapLimit
    for (let i = lastUsed; i < hashes.length; ++i) {
      const scriptHash = hashes[i]
      if (this.addressInfos[scriptHash] && this.addressInfos[scriptHash].used) {
        lastUsed = i
      }
    }

    // If the last used address is too close to the end, generate some more:
    while (lastUsed + this.gapLimit > hashes.length) {
      const newAddr = await this.deriveAddress(`${path}/${hashes.length}`)
      if (!newAddr) break
    }
  }

  /**
   * Derives an address at the specified branch and index from the keyRing,
   * and adds it to the state.
   * @param keyRing The KeyRing corresponding to the selected branch.
   */
  async deriveAddress (
    path: string,
    scriptObj?: Script
  ): Promise<AddressObj | null> {
    // Derive a new Key for desired Address path
    const key = await this.deriveKey(path)
    const redeemScript = ''
    if (!key) return null

    const address = Address.fromKeyPair(
      key,
      key.scriptType,
      this.network,
      redeemScript
    )
    const displayAddress = toNewFormat(address.displayAddress, this.network)

    const { scriptHash } = address

    const pathArray = path.split('/')
    const index = parseInt(pathArray.pop())

    this.scriptHashes[displayAddress] = scriptHash
    this.scriptHashesMap[pathArray.join('/')][index] = scriptHash

    // Report the new Address
    this.emit('newAddress', scriptHash, displayAddress, path, redeemScript)
    return {
      displayAddress,
      scriptHash,
      redeemScript
    }
  }
}
