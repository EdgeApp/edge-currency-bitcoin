// @flow

import EventEmitter from 'eventemitter3'
import { toNewFormat } from '../utils/addressFormat/addressFormatIndex.js'
import { addressFromKey } from '../utils/bcoinUtils/address.js'
import * as HD from '../utils/bcoinUtils/hd.js'
import * as Key from '../utils/bcoinUtils/key.js'
import * as Misc from '../utils/bcoinUtils/misc.js'
import * as Tx from '../utils/bcoinUtils/tx.js'
import type {
  Address,
  Addresses,
  Base58Key,
  BlockHeight,
  HDKey,
  HDMasterKey,
  Output,
  Script,
  StandardOutput,
  TxOptions,
  Utxo
} from '../utils/bcoinUtils/types.js'
import type { AddressInfos } from './engineState.js'

const GAP_LIMIT = 10

export type createTxOptions = {
  outputs?: Array<Output>,
  utxos: Array<Utxo>,
  height: BlockHeight,
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
  base58Key?: Base58Key,
  seed?: string,
  xpub?: string,
  gapLimit: number,
  network: string,
  addressInfos?: AddressInfos,
  scriptHashes?: { [displayAddress: string]: string },
  txInfos?: { [txid: string]: any }
}

export class KeyManager extends EventEmitter {
  writeLock: any
  masterKey: HDMasterKey | HDKey
  scriptTemplates: any
  seed: string
  xpub: string
  gapLimit: number
  network: string
  account: number
  coinType: number

  addressInfos: AddressInfos
  scriptHashes: { [displayAddress: string]: string }
  txInfos: { [txid: string]: any }

  constructor ({
    account = 0,
    coinType = -1,
    base58Key,
    seed = '',
    xpub = '',
    gapLimit = GAP_LIMIT,
    network,
    addressInfos = {},
    scriptHashes = {},
    txInfos = {}
  }: KeyManagerOptions) {
    super()
    // Check for any way to init the wallet with either a seed or master keys
    if (!seed && !xpub && (!base58Key || !base58Key.key)) {
      throw new Error('Missing Master Key')
    }
    this.seed = seed
    this.xpub = xpub
    this.gapLimit = gapLimit
    this.network = network
    this.account = account
    this.coinType = coinType
    // Get Settings for this bip
    const { hdSettings, scriptTemplates } = Misc.getNetworkSettings(network)
    this.scriptTemplates = scriptTemplates
    // Create a lock for when deriving addresses
    this.writeLock = Misc.getLock()
    // Load the master derivation key from base58
    if (base58Key && base58Key.key) {
      this.masterKey = HD.fromBase58(base58Key, network)
    }
    // Fill up the rest of the master key paths according to the hdSettings
    this.masterKey = HD.fromHDSettings(
      this.masterKey,
      hdSettings,
      account,
      coinType
    )
    // Set the addresses and txs state objects
    this.addressInfos = addressInfos
    // Maps from display addresses to script hashes
    this.scriptHashes = scriptHashes
    this.txInfos = txInfos
  }

  // ////////////////////////////////////////////// //
  // /////////////// Public API /////////////////// //
  // ////////////////////////////////////////////// //
  async initMasterKey () {
    if (!this.masterKey || !this.masterKey.key || !this.masterKey.key.priv) {
      if (this.seed === '') {
        throw new Error("Can't init wallet without private key")
      }
      this.masterKey = await HD.initHDKey(
        this.masterKey,
        this.network,
        this.seed,
        this.xpub
      )
    }
  }

  async load () {
    await this.initMasterKey()
    for (const scriptHash in this.addressInfos) {
      const address = this.addressInfos[scriptHash]
      const { displayAddress, path, redeemScript } = address
      const newFormatAddress = toNewFormat(displayAddress, this.network)
      const addressKey: HDKey = HD.createKeyPath(this.masterKey, path)
      addressKey.keyType = 'address'
      addressKey.address = {
        redeemScript,
        path,
        scriptHash,
        displayAddress: newFormatAddress
      }
    }
    await this.setLookAhead(true)
  }

  async reload () {
    this.masterKey.children = {}
    await this.load()
  }

  getReceiveAddress (): Addresses {
    return this.getNextAvailable('receive')
  }

  getChangeAddress (): Addresses {
    return this.getNextAvailable('change')
  }

  async createTX (options: createTxOptions): any {
    const { outputs = [], ...rest } = options
    const standardOutputs: Array<StandardOutput> = []
    for (const output of outputs) {
      const address = output.address
      if (address) standardOutputs.push({ address, value: output.value })
    }
    const changeScriptType = Misc.defaultScriptType(this.network)
    const change = this.getChangeAddress()
    return Tx.createTX({
      ...rest,
      outputs: standardOutputs,
      changeAddress: change[changeScriptType],
      estimate: prev => Tx.estimateSize(changeScriptType, prev),
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
          const addressKey = HD.getKeyForPath(this.masterKey, path)
          const { scriptType } = addressKey || {}
          const key =
            this.masterKey.key &&
            (await HD.keyPair(this.masterKey.key, path, 'privateKey'))
          if (key && key.priv) {
            const keyRing = await Key.fromHDKey(
              key.priv,
              this.network,
              scriptType,
              redeemScript
            )
            keyRings.push(keyRing)
          }
        }
      }
    }
    return Tx.sign(tx, keyRings, this.network)
  }

  async signMessage ({ message, address }: SignMessage) {
    await this.initMasterKey()
    if (!address) throw new Error('Missing address to sign with')
    const scriptHash = this.scriptHashes[address]
    if (!scriptHash) throw new Error('Address is not part of this wallet')
    const addressInfo = this.addressInfos[scriptHash]
    if (!addressInfo) throw new Error('Address is not part of this wallet')
    const { path } = addressInfo
    const { scriptType } = HD.getKeyForPath(this.masterKey, path) || {}
    const key =
      this.masterKey.key &&
      (await HD.keyPair(this.masterKey.key, path, 'privateKey'))
    if (!key || !key.priv) throw new Error('Key is not part of this wallet')
    const keyRing = await Key.fromHDKey(key.priv, this.network, scriptType)
    const signature = await keyRing.sign(Buffer.from(message, 'hex'))
    return {
      signature: signature.toString('hex'),
      publicKey: keyRing.publicKey.toString('hex')
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
    return this.masterKey.key && this.masterKey.key.pub
      ? this.masterKey.key.pub.toBase58(this.network)
      : null
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

  getNextAvailable (purpose: string): Addresses {
    const key = {}
    const change = purpose === 'change' ? '1' : '0'
    const masterBranches = this.masterKey.children
    for (const path in masterBranches) {
      const childKey = masterBranches[path]
      const addressPath = `${childKey.path}/${change}`
      const addressKey = HD.getKeyForPath(childKey, addressPath)
      if (!addressKey) continue
      for (const index in addressKey.children) {
        const {
          address,
          scriptType = Misc.defaultScriptType(this.network)
        } = addressKey.children[index]
        const { scriptHash = '', displayAddress } = address || {}
        if (
          this.addressInfos[scriptHash] &&
          !this.addressInfos[scriptHash].used
        ) {
          key[scriptType] = displayAddress
          break
        }
      }
    }
    return key
  }

  async setLookAhead (closeGaps: boolean = false) {
    const setLookAheadRec = async (hdKey: HDKey) => {
      if (hdKey.keyType === 'publicKey') {
        await this.deriveNewKeys(hdKey, closeGaps)
      } else {
        for (const index in hdKey.children) {
          const childKey = hdKey.children[index]
          await setLookAheadRec(childKey)
        }
      }
    }

    const unlock = await this.writeLock.lock()
    try {
      await setLookAheadRec(this.masterKey)
    } catch (e) {
      console.log(e)
    } finally {
      unlock()
    }
  }

  async deriveNewKeys (hdKey: HDKey, closeGaps: boolean) {
    const children = hdKey.children
    let length = Object.keys(children).length
    // If the chain might have gaps, fill those in:
    if (closeGaps) {
      let index = 0
      for (const path in children) {
        while (index < parseInt(path)) {
          const newAddr = await this.deriveAddress(hdKey, index++)
          if (!newAddr) break
        }
        index++
      }
      // New addresses get appended, so sort them back into position:
      if (Object.keys(children).length > length) {
        hdKey.children = Object.keys(children)
          .sort()
          .reduce(
            (ordered, key) => ({
              ...ordered,
              [key]: children[key]
            }),
            {}
          )
      }
    }

    // Find the last used address:
    length = Object.keys(children).length
    let lastUsed = length < this.gapLimit ? 0 : length - this.gapLimit
    for (let i = lastUsed; i < length; ++i) {
      const { address: { scriptHash } = {} } = children[`${i}`] || {}
      if (
        scriptHash &&
        this.addressInfos[scriptHash] &&
        this.addressInfos[scriptHash].used
      ) {
        lastUsed = i
      }
    }

    // If the last used address is too close to the end, generate some more:
    while (lastUsed + this.gapLimit > Object.keys(children).length) {
      const newAddr = await this.deriveAddress(
        hdKey,
        Object.keys(children).length
      )
      if (!newAddr) break
    }
  }

  /**
   * Derives an address at the specified branch and index from the keyRing,
   * and adds it to the state.
   * @param keyRing The KeyRing corresponding to the selected branch.
   */
  async deriveAddress (
    hdKey: HDKey,
    index: number,
    scriptObj?: Script
  ): Promise<Address | null> {
    // Derive a new Key for desired Address path
    const { key, scriptType } = hdKey
    const redeemScript = ''
    if (!key) return null
    const path = `${hdKey.path}/${index}`
    const addressKeyRing = await Key.fromHDKey(
      key.priv || key.pub,
      this.network,
      scriptType,
      redeemScript
    )
    const address = await addressFromKey(addressKeyRing, this.network)
    const displayAddress = toNewFormat(address.displayAddress, this.network)
    Object.assign(hdKey.children, {
      [`${index}`]: {
        path,
        children: {},
        address: { ...address, displayAddress },
        scriptType
      }
    })

    // Report the new Address
    const { scriptHash } = address
    this.emit('newAddress', scriptHash, displayAddress, path, redeemScript)
    return {
      displayAddress,
      scriptHash,
      redeemScript
    }
  }
}
