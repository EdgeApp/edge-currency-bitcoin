// @flow

import { Utils, Commons, Bip44, Bip32 } from 'perian'
import type { HDPath, HDKey as HDKeyType } from 'perian'
import EventEmitter from 'eventemitter3'
import { toNewFormat } from '../utils/addressFormat/addressFormatIndex.js'
import * as Address from '../utils/bcoinUtils/address.js'
import * as Key from '../utils/bcoinUtils/key.js'
import * as Misc from '../utils/bcoinUtils/misc.js'
import * as Tx from '../utils/bcoinUtils/tx.js'
import type {
  Address as AddressObj,
  ScriptHashMap,
  EdgeAddress,
  Output,
  Script,
  StandardOutput,
  TxOptions,
  Utxo
} from '../utils/bcoinUtils/types.js'
import type { AddressInfos } from './engineState.js'

const { HDKey } = Bip44
const { ExtendedKey } = Bip32
const { Network } = Commons

const GAP_LIMIT = 10

export type createTxOptions = {
  outputs?: Array<Output>,
  utxos: Array<Utxo>,
  height: number,
  rate: number,
  maxFee: number,
  txOptions: TxOptions
}

export type SignMessage = {
  message: string,
  address: string
}

export type KeyManagerOptions = {
  account?: number,
  coinType?: number,
  masterKey?: HDKeyType,
  seed?: string,
  xpub?: string,
  gapLimit: number,
  network: string,
  addressInfos?: AddressInfos,
  scriptHashes?: { [displayAddress: string]: string },
  scriptHashesMap?: ScriptHashMap,
  txInfos?: { [txid: string]: any }
}

export class KeyManager extends EventEmitter {
  writeLock: any
  masterKey: HDKeyType
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
    txInfos = {}
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
    // const { scriptTemplates } = Network.networks[network]
    this.hdPaths = Network.getHDPaths(this.network, { account, coinType })
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
    // Fill in the missing maps in case we need to
    if (Object.keys(scriptHashes).length < Object.keys(addressInfos).length) {
      for (const scriptHash in this.addressInfos) {
        const address = this.addressInfos[scriptHash]
        const { displayAddress, path } = address
        this.scriptHashes[displayAddress] = scriptHash

        const pathArray = path.split('/')
        const index = parseInt(pathArray.pop())
        const parentPath = pathArray.join('/')
        if (!this.scriptHashesMap[parentPath]) {
          this.scriptHashesMap[parentPath] = []
        }
        this.scriptHashesMap[parentPath][index] = scriptHash
      }
    }
  }

  // ////////////////////////////////////////////// //
  // /////////////// Public API /////////////////// //
  // ////////////////////////////////////////////// //
  async initMasterKey (forceInit: boolean = false) {
    if (!this.masterKey || !this.masterKey.privateKey || forceInit) {
      if (this.seed === '') {
        throw new Error("Can't init wallet without private key")
      }
      const hexSeed = Key.seedToHex(this.seed, this.network)
      this.masterKey = await HDKey.fromSeed(hexSeed, this.network)
    }
    this.masterKey = await HDKey.fromHDPaths(
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
  }

  async deriveKey (path: string): Promise<HDKeyType> {
    const pathArray = path.split('/')
    const index = pathArray.pop()

    let parentKey = HDKey.getHDKey(this.masterKey, pathArray)
    if (!parentKey) {
      this.masterKey = await HDKey.fromParent(
        this.masterKey,
        { path: pathArray },
        this.network
      )
      parentKey = HDKey.getHDKey(this.masterKey, pathArray)
    }

    if (!parentKey) throw new Error('Cannot get parent key')
    const key = await ExtendedKey.fromParent(parentKey, index, this.network)

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
    for (const path in this.scriptHashesMap) {
      if (path[path.length - 1] !== '1') continue
      const scriptHashes = this.scriptHashesMap[path]
      const scriptHash = scriptHashes[scriptHashes.length - 1]
      const { displayAddress } = this.addressInfos[scriptHash]
      const hdKey = HDKey.getHDKey(this.masterKey, path.split('/'))
      if (hdKey && hdKey.scriptType) {
        addresses[hdKey.scriptType] = displayAddress
      } else {
        const defaultScript = Network.getDefaultScriptType(this.network)
        addresses[defaultScript] = displayAddress
      }
    }
    return addresses
  }

  getChangeAddress (): { changeAddress?: string, scriptType: string } {
    const scriptType = Network.getDefaultScriptType(this.network)
    for (const hdPath of this.hdPaths) {
      if (scriptType !== hdPath.scriptType) continue
      const path = hdPath.path.join('/')
      const scriptHashes = this.scriptHashesMap[path]
      const scriptHash = scriptHashes[scriptHashes.length - 1]
      const address = this.addressInfos[scriptHash]
      if (!address) continue
      const changeAddress = address.displayAddress
      return { changeAddress, scriptType }
    }
    return { scriptType }
  }

  async createTX (options: createTxOptions): any {
    const { outputs = [], ...rest } = options
    const standardOutputs: Array<StandardOutput> = []
    for (const output of outputs) {
      const address = output.address
      if (address) standardOutputs.push({ address, value: output.value })
    }

    const { changeAddress, scriptType } = this.getChangeAddress()
    if (!changeAddress) {
      throw new Error('Cannot createTX without change address')
    }
    return Tx.createTX({
      ...rest,
      outputs: standardOutputs,
      changeAddress: changeAddress,
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
      const signature = await Utils.Crypto.sign(message, privateKey)
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
        const scriptHashes = this.scriptHashesMap[path]
        // Get the last index unused index
        let index = scriptHashes.length - this.gapLimit - 1
        let actualGap = 0
        while (actualGap < this.gapLimit) {
          // Check if we reached the end of the list
          if (index > scriptHashes.length) {
            actualGap = 0
            const newAddr = await this.deriveAddress(`${path}/${index}`)
            if (!newAddr) throw new Error('Cannot derive address')
          } else {
            // Check if the index is used or not
            const scriptHash = scriptHashes[index]
            if (!this.addressInfos[scriptHash]) break
            const used = this.addressInfos[scriptHash].used
            if (!used) actualGap++
            else if (actualGap) actualGap--
          }
          // Advance the index
          index++
        }
      }
    } catch (e) {
      console.log(e)
    } finally {
      unlock()
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
