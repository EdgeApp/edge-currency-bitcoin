// @flow
import EventEmitter from 'eventemitter3'
import type { AddressInfo, AddressInfos } from './engineState.js'
import type {
  Utxo,
  BlockHeight,
  TxOptions,
  Output,
  StandardOutput,
  Script,
  Branches
} from '../utils/bcoinUtils/types.js'
import * as Hd from '../utils/bcoinUtils/hd.js'
import * as Misc from '../utils/bcoinUtils/misc.js'
import * as Tx from '../utils/bcoinUtils/tx.js'
import * as Key from '../utils/bcoinUtils/key.js'
import { toNewFormat } from '../utils/addressFormat/addressFormatIndex.js'

const GAP_LIMIT = 10

export type Address = {
  displayAddress: string,
  scriptHash: string,
  index: number,
  branch: number,
  redeemScript?: string
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
  xpub?: RawKey
}

export type RawKeys = {
  master?: RawKeyRing,
  receive?: RawKeyRing,
  change?: RawKeyRing
}

// export type Address2 = {
//   displayAddress: string,
//   scriptHash: string,
//   index: number,
//   branch: number,
//   redeemScript?: string
// }

// export type RawKeys2 = {
//   keys?: RawKeyRing,
//   index?: number,
//   scriptType?: string,
//   children?: { [index: number]: RawKeys2 }
// }

// export type KeyRing2 = {
//   pubKey: any,
//   privKey: any,
//   index?: number,
//   children?: { [index: number]: RawKeys2 }
// }

// export type Keys2 = {
//   master: KeyRing2,
//   receive: KeyRing2,
//   change: KeyRing2
// }

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
  forceBranch?: string,
  coinType?: number,
  rawKeys?: RawKeys,
  seed?: string,
  gapLimit: number,
  network: string,
  addressInfos?: AddressInfos,
  scriptHashes?: { [displayAddress: string]: string },
  txInfos?: { [txid: string]: any }
}

export class KeyManager extends EventEmitter {
  masterPath: string
  writeLock: any
  defaultBranchNumber: number
  keys: Keys
  nested: boolean
  witness: boolean
  branches: Branches
  scriptTemplates: any
  seed: string
  gapLimit: number
  network: string

  addressInfos: AddressInfos
  scriptHashes: { [displayAddress: string]: string }
  txInfos: { [txid: string]: any }

  constructor ({
    account = 0,
    forceBranch,
    coinType = -1,
    rawKeys = {},
    seed = '',
    gapLimit = GAP_LIMIT,
    network,
    addressInfos = {},
    scriptHashes = {},
    txInfos = {}
  }: KeyManagerOptions) {
    super()
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
    // Get Settings for this bip
    const { scriptTemplates, branches } = Hd.getBranchesSettings(
      network,
      forceBranch
    )
    const { path, branchNumber, nested, witness, addresses } = branches[
      'default'
    ]
    this.branches = addresses.reduce((branches, { index = 0, purpose }) => {
      return { ...branches, [index]: purpose }
    }, {})

    this.defaultBranchNumber = branchNumber
    this.nested = nested
    this.witness = witness
    this.scriptTemplates = scriptTemplates
    // Create a lock for when deriving addresses
    this.writeLock = Misc.getLock()
    // Create the master derivation path
    this.masterPath = path(account, coinType, network)
    // Set the addresses and txs state objects
    this.addressInfos = addressInfos
    // Maps from display addresses to script hashes
    this.scriptHashes = scriptHashes
    this.txInfos = txInfos
    // Create KeyRings while tring to load as many of the pubKey/privKey from the cache
    this.keys = Key.keysFromRaw(this.branches, network, rawKeys)
    // Load addresses from Cache
    for (const scriptHash in addressInfos) {
      const addressObj: AddressInfo = addressInfos[scriptHash]
      const path = Hd.parsePath(addressObj.path, this.masterPath)
      if (path.length) {
        const [branch, index] = path
        const displayAddress = toNewFormat(addressObj.displayAddress, network)
        const { redeemScript } = addressObj
        const address = {
          displayAddress,
          scriptHash,
          index,
          branch,
          redeemScript
        }
        const branchName = this.branches[`${branch}`]
        this.keys[branchName].children.push(address)
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
    if (this.defaultBranchNumber === 32) return this.getReceiveAddress()
    return this.getNextAvailable(this.keys.change.children)
  }

  async createTX (options: createTxOptions): any {
    const { outputs = [], ...rest } = options
    const standardOutputs: Array<StandardOutput> = []
    for (const output of outputs) {
      let { address = '' } = output
      if (output.script) {
        const { type, params } = output.script
        const keyRing = this.keys[type]
        if (params && params.length) {
          const index = keyRing.children.length
          const branch = Object.keys(this.branches).find(
            num => type === this.branches[num]
          )
          if (!branch) throw new Error(`Branch does not exist`)
          const addressObj = await this.deriveAddress(
            keyRing,
            parseInt(branch),
            index,
            output.script
          )
          if (!addressObj) {
            throw new Error(`Error creating address from script type ${type}`)
          }
          address = addressObj.displayAddress
        } else {
          address = this.getNextAvailable(keyRing.children)
        }
      }
      if (address) standardOutputs.push({ address, value: output.value })
    }
    return Tx.createTX({
      ...rest,
      outputs: standardOutputs,
      changeAddress: this.getChangeAddress(),
      estimate: prev => Tx.estimateSize(this.defaultBranchNumber, prev),
      network: this.network
    })
  }

  async sign (tx: any, privateKeys: Array<string> = []) {
    const keyRings = await Key.getAllKeyRings(privateKeys, this.network)
    if (!keyRings.length) {
      if (!this.keys.master.privKey && this.seed === '') {
        throw new Error("Can't sign without private key")
      }
      await this.initMasterKeys()
      for (const input: any of tx.inputs) {
        const { prevout } = input
        if (prevout) {
          const { branch, index, redeemScript } = this.utxoToAddress(prevout)
          const branchName = this.branches[`${branch}`]
          const keyRing = this.keys[branchName]
          if (!keyRing.privKey) {
            keyRing.privKey = await Hd.deriveHdKey(
              this.keys.master.privKey,
              branch
            )
            this.saveKeysToCache()
          }
          const key = await Hd.deriveKeyRing(
            keyRing.privKey,
            index,
            this.nested,
            this.witness,
            this.network,
            redeemScript
          )
          keyRings.push(key)
        }
      }
    }
    return Tx.sign(tx, keyRings, this.network)
  }

  async signMessage ({ message, address }: SignMessage) {
    if (!this.keys.master.privKey && this.seed === '') {
      throw new Error("Can't sign without private key")
    }
    await this.initMasterKeys()
    if (!address) throw new Error('Missing address to sign with')
    const scriptHash = this.scriptHashes[address]
    if (!scriptHash) throw new Error('Address is not part of this wallet')
    const addressInfo = this.addressInfos[scriptHash]
    if (!addressInfo) throw new Error('Address is not part of this wallet')
    const { path } = addressInfo
    const pathSuffix = path.split(this.masterPath + '/')[1]
    const [branch: string, index: string] = pathSuffix.split('/')
    const branchName = this.branches[`${branch}`]
    const keyRing = this.keys[branchName]
    if (!keyRing.privKey) {
      keyRing.privKey = await Hd.deriveHdKey(
        this.keys.master.privKey,
        parseInt(branch)
      )
      this.saveKeysToCache()
    }
    const key = await Hd.deriveKeyRing(
      keyRing.privKey,
      parseInt(index),
      this.nested,
      this.witness,
      this.network
    )
    const signature = await key.sign(Buffer.from(message, 'hex'))
    return {
      signature: signature.toString('hex'),
      publicKey: key.publicKey.toString('hex')
    }
  }

  getSeed (): string | null {
    if (this.seed && this.seed !== '') {
      try {
        return Key.parseSeed(this.defaultBranchNumber, this.seed)
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

  utxoToAddress (
    prevout: any
  ): { branch: number, index: number, redeemScript?: string } {
    const parsedTx = this.txInfos[prevout.rhash()]
    if (!parsedTx) throw new Error('UTXO not synced yet')
    const output = parsedTx.outputs[prevout.index]
    if (!output) throw new Error('Corrupt UTXO or output list')
    const scriptHash = output.scriptHash
    const address = this.addressInfos[scriptHash]
    if (!address) throw new Error('Address is not part of this wallet')
    const { path, redeemScript } = address
    const pathSuffix = path.split(this.masterPath + '/')[1]
    const [branch, index] = pathSuffix.split('/')
    return { branch: parseInt(branch), index: parseInt(index), redeemScript }
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
    const keys = await Key.getMasterKeys(
      this.seed,
      this.masterPath,
      this.network,
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
      this.emit('newKey', keys)
    } catch (e) {
      console.log(e)
    }
  }

  async setLookAhead (closeGaps: boolean = false) {
    const unlock = await this.writeLock.lock()
    try {
      for (const branchNum in this.branches) {
        const branchName = this.branches[branchNum]
        await this.deriveNewKeys(
          this.keys[branchName],
          parseInt(branchNum),
          closeGaps
        )
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
      keyRing.pubKey = await Hd.deriveHdKey(this.keys.master.pubKey, branch)
      this.saveKeysToCache()
    }

    // If the chain might have gaps, fill those in:
    if (closeGaps) {
      let index = 0
      const length = children.length
      for (let i = 0; i < length; ++i, ++index) {
        while (index < children[i].index) {
          const newAddr = await this.deriveAddress(keyRing, branch, index++)
          if (!newAddr) break
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
      const newAddr = await this.deriveAddress(keyRing, branch, children.length)
      if (!newAddr) break
    }
  }

  /**
   * Derives an address at the specified branch and index from the keyRing,
   * and adds it to the state.
   * @param keyRing The KeyRing corresponding to the selected branch.
   */
  async deriveAddress (
    keyRing: KeyRing,
    branch: number,
    index: number,
    scriptObj?: Script
  ): Promise<Address | null> {
    let newAddress = {}

    if (
      (scriptObj && this.scriptTemplates[scriptObj.type]) ||
      this.scriptTemplates[this.branches[`${branch}`]]
    ) {
      newAddress = await Hd.deriveScriptAddress(
        keyRing.pubKey,
        index,
        branch,
        this.nested,
        this.witness,
        this.network,
        this.branches,
        this.scriptTemplates,
        scriptObj
      )
    } else if (scriptObj && !this.scriptTemplates[scriptObj.type]) {
      throw new Error('Unkown script template')
    } else {
      newAddress = await Hd.deriveAddress(
        keyRing.pubKey,
        index,
        this.nested,
        this.witness,
        this.network
      )
    }

    if (!newAddress) return null
    const { address, scriptHash, redeemScript } = newAddress
    const displayAddress = toNewFormat(address, this.network)
    const keyPath = `${this.masterPath}/${branch}/${index}`
    const addressObj = {
      displayAddress,
      scriptHash,
      index,
      branch,
      redeemScript
    }
    keyRing.children.push(addressObj)
    this.emit('newAddress', scriptHash, displayAddress, keyPath, redeemScript)
    return addressObj
  }
}
