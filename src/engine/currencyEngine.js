// @flow
import type {
  AbcWalletInfo,
  AbcCurrencyEngine,
  AbcCurrencyEngineOptions,
  AbcFreshAddress,
  AbcSpendInfo,
  AbcTransaction,
  AbcCurrencyInfo,
  AbcSpendTarget,
  AbcDataDump
} from 'edge-core-js'

import { EngineState } from './engineState.js'
import { PluginState } from '../plugin/pluginState.js'
import { KeyManager } from './keyManager'
import type { EngineStateCallbacks } from './engineState.js'
import type { KeyManagerCallbacks } from './keyManager'
import type { EarnComFees, BitcoinFees } from '../utils/flowTypes.js'
import { validateObject } from '../utils/utils.js'
import { InfoServerFeesSchema } from '../utils/jsonSchemas.js'
import { calcFeesFromEarnCom, calcMinerFeePerByte } from './miningFees.js'
import { bns } from 'biggystring'
import {
  toLegacyFormat,
  toNewFormat,
  validAddress
} from '../utils/addressFormat/addressFormatIndex.js'
import bcoin from 'bcoin'

const BYTES_TO_KB = 1000
const MILLI_TO_SEC = 1000
/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyEngine {
  walletInfo: AbcWalletInfo
  walletId: string
  currencyInfo: AbcCurrencyInfo
  keyManager: KeyManager
  engineState: EngineState
  pluginState: PluginState
  abcCurrencyEngineOptions: AbcCurrencyEngineOptions
  network: string
  infoServer: string
  feeInfoServer: string
  feeUpdateInterval: number
  feeTimer: any
  fees: BitcoinFees

  // ------------------------------------------------------------------------
  // Private API
  // ------------------------------------------------------------------------
  constructor (
    walletInfo: AbcWalletInfo,
    currencyInfo: AbcCurrencyInfo,
    pluginState: PluginState,
    options: AbcCurrencyEngineOptions
  ) {
    // Validate that we are a valid AbcCurrencyEngine:
    // eslint-disable-next-line no-unused-vars
    const test: AbcCurrencyEngine = this

    this.walletInfo = walletInfo
    this.walletId = walletInfo.id || ''
    this.currencyInfo = currencyInfo
    this.pluginState = pluginState
    this.abcCurrencyEngineOptions = options
    this.network = this.currencyInfo.defaultSettings.network.type
    this.infoServer = this.currencyInfo.defaultSettings.infoServer
    this.feeInfoServer = this.currencyInfo.defaultSettings.feeInfoServer
    this.feeUpdateInterval = this.currencyInfo.defaultSettings.feeUpdateInterval
    this.fees = {
      highFee: '',
      lowFee: '',
      standardFeeLow: '',
      standardFeeHigh: '',
      standardFeeLowAmount: '',
      standardFeeHighAmount: '',
      timestamp: 0
    }
    if (this.currencyInfo.defaultSettings.simpleFeeSettings) {
      Object.assign(
        this.fees,
        this.currencyInfo.defaultSettings.simpleFeeSettings
      )
    }
    console.log(
      `${this.walletId} - Created Wallet Type ${
        this.walletInfo.type
      } for Currency Plugin ${this.currencyInfo.pluginName}`
    )
  }

  async load (): Promise<any> {
    const engineStateCallbacks: EngineStateCallbacks = {
      onHeightUpdated: (height: number) => {
        this.abcCurrencyEngineOptions.callbacks.onBlockHeightChanged(height)
      },
      onTxFetched: (txid: string) => {
        const abcTransaction = this.getTransaction(txid)
        this.abcCurrencyEngineOptions.callbacks.onTransactionsChanged([
          abcTransaction
        ])
      }
    }
    const gapLimit = this.currencyInfo.defaultSettings.gapLimit
    const io = this.abcCurrencyEngineOptions.optionalSettings
      ? this.abcCurrencyEngineOptions.optionalSettings.io
      : null

    this.engineState = new EngineState({
      callbacks: engineStateCallbacks,
      io: io,
      localFolder: this.abcCurrencyEngineOptions.walletLocalFolder,
      encryptedLocalFolder: this.abcCurrencyEngineOptions
        .walletLocalEncryptedFolder,
      pluginState: this.pluginState,
      walletId: this.walletId
    })

    await this.engineState.load()

    const keyManagerCallbacks: KeyManagerCallbacks = {
      onNewAddress: (scriptHash: string, address: string, path: string) => {
        return this.engineState.addAddress(scriptHash, address, path)
      },
      onNewKey: (keys: any) => this.engineState.saveKeys(keys)
    }

    const rawKeys = await this.engineState.loadKeys()
    if (!rawKeys.master) {
      rawKeys.master = {}
    }
    if (!rawKeys.master.xpub) {
      if (this.walletInfo.keys && this.walletInfo.keys[`${this.network}Xpub`]) {
        rawKeys.master.xpub = this.walletInfo.keys[`${this.network}Xpub`]
      }
    }
    let seed = ''
    let bip = ''
    let coinType = -1
    if (this.walletInfo.keys) {
      if (this.walletInfo.keys[`${this.network}Key`]) {
        seed = this.walletInfo.keys[`${this.network}Key`]
      }
      if (typeof this.walletInfo.keys.format === 'string') {
        bip = this.walletInfo.keys.format
      }
      if (typeof this.walletInfo.keys.coinType === 'number') {
        coinType = this.walletInfo.keys.coinType
      }
    }
    bip = bip === '' ? this.walletInfo.type.split('-')[1] : bip

    this.keyManager = new KeyManager({
      seed: seed,
      rawKeys: rawKeys,
      bip: bip,
      coinType: coinType,
      gapLimit: gapLimit,
      network: this.network,
      callbacks: keyManagerCallbacks,
      addressInfos: this.engineState.addressInfos,
      txInfos: this.engineState.parsedTxs
    })

    this.engineState.onAddressUsed = () => {
      this.keyManager.setLookAhead()
    }

    this.engineState.onBalanceChanged = () => {
      this.abcCurrencyEngineOptions.callbacks.onBalanceChanged(
        this.currencyInfo.currencyCode,
        this.getBalance()
      )
    }

    await this.keyManager.load()
  }

  getTransaction (txid: string): AbcTransaction {
    const { height = -1, firstSeen = Date.now() } =
      this.engineState.txHeightCache[txid] || {}
    let date = firstSeen
    // If confirmed, we will try and take the timestamp as the date
    if (height && height !== -1) {
      const blockHeight = this.pluginState.headerCache[`${height}`]
      if (blockHeight) {
        date = blockHeight.timestamp
      }
    }
    // Get parsed bcoin tx from engine
    const bcoinTransaction = this.engineState.parsedTxs[txid]
    if (!bcoinTransaction) {
      throw new Error('Transaction not found')
    }

    const ourReceiveAddresses = []
    let nativeAmount = 0
    let totalOutputAmount = 0
    let totalInputAmount = 0
    let address = ''
    let value = 0
    let output = null

    // Process tx outputs
    const outputsLength = bcoinTransaction.outputs.length
    for (let i = 0; i < outputsLength; i++) {
      output = bcoinTransaction.outputs[i].getJSON(this.network)
      value = output.value
      address = toNewFormat(output.address, this.network)
      totalOutputAmount += value
      if (this.engineState.scriptHashes[address]) {
        nativeAmount += value
        ourReceiveAddresses.push(address)
      }
    }

    let input = null
    let prevoutBcoinTX = null
    let index = 0
    let hash = ''
    // Process tx inputs
    const inputsLength = bcoinTransaction.inputs.length
    for (let i = 0; i < inputsLength; i++) {
      input = bcoinTransaction.inputs[i]
      if (input.prevout) {
        hash = input.prevout.rhash()
        index = input.prevout.index
        prevoutBcoinTX = this.engineState.parsedTxs[hash]
        if (prevoutBcoinTX) {
          output = prevoutBcoinTX.outputs[index].getJSON(this.network)
          value = output.value
          address = toNewFormat(output.address, this.network)
          totalInputAmount += value
          if (this.engineState.scriptHashes[address]) {
            nativeAmount -= value
          }
        }
      }
    }

    const fee = totalInputAmount ? totalInputAmount - totalOutputAmount : 0
    const abcTransaction: AbcTransaction = {
      ourReceiveAddresses,
      currencyCode: this.currencyInfo.currencyCode,
      otherParams: {},
      txid: txid,
      date: date,
      blockHeight: height,
      nativeAmount: `${nativeAmount}`,
      networkFee: `${fee}`,
      signedTx: this.engineState.txCache[txid]
    }
    return abcTransaction
  }

  async updateFeeTable () {
    try {
      if (
        !this.abcCurrencyEngineOptions.optionalSettings ||
        !this.abcCurrencyEngineOptions.optionalSettings.io ||
        !this.abcCurrencyEngineOptions.optionalSettings.io.fetch
      ) {
        throw new Error('No io/fetch object')
      }
      await this.fetchFee()
      if (Date.now() - this.fees.timestamp > this.feeUpdateInterval) {
        const url = `${this.infoServer}/networkFees/${
          this.currencyInfo.currencyCode
        }`
        if (!this.abcCurrencyEngineOptions.optionalSettings) {
          throw new Error('Missing optionalSettings')
        }
        const feesResponse = await this.abcCurrencyEngineOptions.optionalSettings.io.fetch(
          url
        )
        const feesJson = await feesResponse.json()
        if (validateObject(feesJson, InfoServerFeesSchema)) {
          this.fees = feesJson
          this.fees.timestamp = Date.now()
        } else {
          throw new Error('Fetched invalid networkFees')
        }
      }
    } catch (err) {
      console.log(`${this.walletId} - ${err.toString()}`)
    }
  }

  async fetchFee () {
    if (!this.feeInfoServer || this.feeInfoServer === '') {
      clearTimeout(this.feeTimer)
      return
    }
    try {
      if (Date.now() - this.fees.timestamp > this.feeUpdateInterval) {
        if (!this.abcCurrencyEngineOptions.optionalSettings) {
          throw new Error('Missing optionalSettings')
        }
        const results = await this.abcCurrencyEngineOptions.optionalSettings.io.fetch(
          this.feeInfoServer
        )
        if (results.status !== 200) {
          throw new Error(results.body)
        }
        const { fees }: EarnComFees = await results.json()
        this.fees = calcFeesFromEarnCom(this.fees, { fees })
        this.fees.timestamp = Date.now()
      }
    } catch (e) {
      console.log(
        `${
          this.walletId
        } - Error while trying to update fee table ${e.toString()}`
      )
    }
    this.feeTimer = setTimeout(() => this.fetchFee(), this.feeUpdateInterval)
  }

  getRate ({
    spendTargets,
    networkFeeOption = 'standard',
    customNetworkFee = {}
  }: AbcSpendInfo): number {
    const customFeeSetting = this.currencyInfo.defaultSettings
      .customFeeSettings[0]
    const customFeeAmount = customNetworkFee[customFeeSetting] || '0'
    if (networkFeeOption === 'custom' && customFeeAmount !== '0') {
      // customNetworkFee is in sat/Bytes in need to be converted to sat/KB
      return parseInt(customFeeAmount) * BYTES_TO_KB
    } else {
      const amountForTx = spendTargets
        .reduce((s, { nativeAmount }) => s + parseInt(nativeAmount), 0)
        .toString()
      const rate = calcMinerFeePerByte(
        amountForTx,
        networkFeeOption,
        this.fees,
        customFeeAmount
      )
      return parseInt(rate) * BYTES_TO_KB
    }
  }

  getUTXOs () {
    const utxos: any = []
    for (const scriptHash in this.engineState.addressInfos) {
      const utxoLength = this.engineState.addressInfos[scriptHash].utxos.length
      for (let i = 0; i < utxoLength; i++) {
        const utxo = this.engineState.addressInfos[scriptHash].utxos[i]
        let height = -1
        if (this.engineState.txHeightCache[utxo.txid]) {
          height = this.engineState.txHeightCache[utxo.txid].height
        }
        utxos.push({ utxo, height })
      }
    }
    return utxos
  }

  logAbcTransaction (abcTransaction: AbcTransaction, action: string) {
    let log = `------------------ ${action} Transaction ------------------\n`
    log += `Transaction id: ${abcTransaction.txid}\n`
    log += `Our Receiving addresses are: ${abcTransaction.ourReceiveAddresses.toString()}\n`
    log += 'Transaction details:\n'
    const jsonObj = abcTransaction.otherParams.bcoinTx.getJSON(this.network)
    log += JSON.stringify(jsonObj, null, 2) + '\n'
    log += '------------------------------------------------------------------'
    console.log(`${this.walletId} - ${log}`)
  }
  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------
  updateSettings (settings: any): void {
    // TODO: Implement this
  }

  async startEngine (): Promise<void> {
    const cachedTXs = await this.getTransactions()
    this.abcCurrencyEngineOptions.callbacks.onTransactionsChanged(cachedTXs)
    this.abcCurrencyEngineOptions.callbacks.onBalanceChanged(
      this.currencyInfo.currencyCode,
      this.getBalance()
    )
    this.updateFeeTable()
    return this.engineState.connect()
  }

  async killEngine (): Promise<void> {
    clearTimeout(this.feeTimer)
    return this.engineState.disconnect()
  }

  async resyncBlockchain (): Promise<void> {
    await this.killEngine()
    await this.engineState.clearCache()
    await this.pluginState.clearCache()
    await this.keyManager.reload()
    await this.startEngine()
  }

  getBlockHeight (): number {
    return this.pluginState.height
  }

  async enableTokens (tokens: Array<string>): Promise<void> {}

  async getEnabledTokens (): Promise<Array<string>> {
    return []
  }

  addCustomToken (token: any): Promise<void> {
    return Promise.reject(new Error('This plugin has no tokens'))
  }

  disableTokens (tokens: Array<string>): Promise<void> {
    return Promise.reject(new Error('This plugin has no tokens'))
  }

  getTokenStatus (token: string): boolean {
    return false
  }

  getBalance (options: any): string {
    let totalBalance = 0
    for (const scriptHash in this.engineState.addressInfos) {
      const { balance } = this.engineState.addressInfos[scriptHash]
      totalBalance += balance
    }
    return `${totalBalance}`
  }

  getNumTransactions (options: any): number {
    return Object.keys(this.engineState.txCache).length
  }

  async getTransactions (options: any): Promise<Array<AbcTransaction>> {
    const rawTxs = this.engineState.txCache
    const abcTransactions = []
    for (const txid in rawTxs) {
      const abcTransaction = this.getTransaction(txid)
      abcTransactions.push(abcTransaction)
    }

    const startIndex = (options && options.startIndex) || 0
    let endIndex =
      (options && options.numEntries + startIndex) || abcTransactions.length
    if (startIndex + endIndex > abcTransactions.length) {
      endIndex = abcTransactions.length
    }
    return abcTransactions.slice(startIndex, endIndex)
  }

  getFreshAddress (options: any): AbcFreshAddress {
    const publicAddress = this.keyManager.getReceiveAddress()
    const legacyAddress = toLegacyFormat(publicAddress, this.network)
    return { publicAddress, legacyAddress }
  }

  addGapLimitAddresses (addresses: Array<string>, options: any): void {
    const scriptHashPromises = addresses.map(address => {
      const scriptHash = this.engineState.scriptHashes[address]
      if (typeof scriptHash === 'string') return Promise.resolve(scriptHash)
      else return this.keyManager.addressToScriptHash(address)
    })
    Promise.all(scriptHashPromises)
      .then((scriptHashs: Array<string>) => {
        this.engineState.markAddressesUsed(scriptHashs)
        if (this.keyManager) this.keyManager.setLookAhead()
      })
      .catch(e => console.log(`${this.walletId} - ${e.toString()}`))
  }

  isAddressUsed (address: string, options: any): boolean {
    if (!validAddress(address, this.network)) {
      throw new Error('Wrong formatted address')
    }
    for (const scriptHash in this.engineState.addressInfos) {
      if (
        this.engineState.addressInfos[scriptHash].displayAddress === address
      ) {
        return this.engineState.addressInfos[scriptHash].used
      }
    }
    return false
  }

  async makeSpend (
    abcSpendInfo: AbcSpendInfo,
    options?: any = {}
  ): Promise<AbcTransaction> {
    // Can't spend without outputs
    if (
      !options.CPFP &&
      (!abcSpendInfo.spendTargets || abcSpendInfo.spendTargets.length < 1)
    ) {
      throw new Error('Need to provide Spend Targets')
    }
    const totalAmountToSend = abcSpendInfo.spendTargets.reduce(
      (sum, { nativeAmount }) => bns.add(sum, nativeAmount || '0'),
      '0'
    )
    if (bns.gt(totalAmountToSend, this.getBalance())) {
      throw new Error('InsufficientFundsError')
    }
    try {
      // If somehow we have outdated fees, try and get new ones
      if (Date.now() - this.fees.timestamp > this.feeUpdateInterval) {
        await this.updateFeeTable()
      }
      Object.assign(options, {
        rate: this.getRate(abcSpendInfo),
        maxFee: this.currencyInfo.defaultSettings.maxFee,
        outputs: abcSpendInfo.spendTargets,
        utxos: this.getUTXOs(),
        height: this.getBlockHeight()
      })
      const resultedTransaction = await this.keyManager.createTX(options)
      const sumOfTx = abcSpendInfo.spendTargets.reduce(
        (s, spendTarget: AbcSpendTarget) => {
          if (
            spendTarget.publicAddress &&
            this.engineState.scriptHashes[spendTarget.publicAddress]
          ) {
            return s
          } else return s - parseInt(spendTarget.nativeAmount)
        },
        0
      )

      const ourReceiveAddresses = []
      for (const i in resultedTransaction.outputs) {
        let address = resultedTransaction.outputs[i]
          .getAddress()
          .toString(this.network)
        address = toNewFormat(address, this.network)
        if (address && this.engineState.scriptHashes[address]) {
          ourReceiveAddresses.push(address)
        }
      }

      const abcTransaction: AbcTransaction = {
        ourReceiveAddresses,
        otherParams: {
          bcoinTx: resultedTransaction,
          abcSpendInfo,
          rate: options.rate
        },
        currencyCode: this.currencyInfo.currencyCode,
        txid: '',
        date: 0,
        blockHeight: 0,
        nativeAmount: `${sumOfTx - parseInt(resultedTransaction.getFee())}`,
        networkFee: `${resultedTransaction.getFee()}`,
        signedTx: ''
      }
      return abcTransaction
    } catch (e) {
      if (e.type === 'FundingError') throw new Error('InsufficientFundsError')
      throw e
    }
  }

  async signTx (abcTransaction: AbcTransaction): Promise<AbcTransaction> {
    this.logAbcTransaction(abcTransaction, 'Signing')
    await this.keyManager.sign(abcTransaction.otherParams.bcoinTx)
    abcTransaction.date = Date.now() / MILLI_TO_SEC
    abcTransaction.signedTx = abcTransaction.otherParams.bcoinTx
      .toRaw()
      .toString('hex')
    abcTransaction.txid = abcTransaction.otherParams.bcoinTx.rhash()
    return abcTransaction
  }

  async broadcastTx (abcTransaction: AbcTransaction): Promise<AbcTransaction> {
    if (!abcTransaction.otherParams.bcoinTx) {
      abcTransaction.otherParams.bcoinTx = bcoin.primitives.TX.fromRaw(
        abcTransaction.signedTx,
        'hex'
      )
    }
    this.logAbcTransaction(abcTransaction, 'Broadcasting')
    for (const output of abcTransaction.otherParams.bcoinTx.outputs) {
      if (output.value <= 0 || output.value === '0') {
        throw new Error('Wrong spend amount')
      }
    }
    const txid = await this.engineState.broadcastTx(abcTransaction.signedTx)
    if (!abcTransaction.txid) abcTransaction.txid = txid
    return abcTransaction
  }

  saveTx (abcTransaction: AbcTransaction): Promise<void> {
    this.logAbcTransaction(abcTransaction, 'Saving')
    this.engineState.saveTx(abcTransaction.txid, abcTransaction.signedTx)
    return Promise.resolve()
  }

  getDisplayPrivateSeed (): string | null {
    if (this.walletInfo.keys && this.walletInfo.keys[`${this.network}Key`]) {
      const privateKey = this.walletInfo.keys[`${this.network}Key`]
      if (this.keyManager.bip !== 'bip32') return privateKey
      try {
        const keyBuffer = Buffer.from(privateKey, 'base64')
        return keyBuffer.toString('hex')
      } catch (e) {
        console.log(e)
        return null
      }
    }
    return null
  }

  getDisplayPublicSeed (): string | null {
    if (this.walletInfo.keys && this.walletInfo.keys[`${this.network}Xpub`]) {
      return this.walletInfo.keys[`${this.network}Xpub`]
    }
    return null
  }

  dumpData (): AbcDataDump {
    const dataDump: AbcDataDump = {
      walletId: this.walletId.split(' - ')[0],
      walletType: this.walletInfo.type,
      pluginType: this.currencyInfo.pluginName,
      fees: this.fees,
      data: {}
    }
    const add = (cache, obj) => {
      // $FlowFixMe
      dataDump.data[`${obj}.${cache}`] = this[obj][cache]
    }

    const engineCache = [
      'addressCache',
      'addressInfos',
      'scriptHashes',
      'usedAddresses',
      'txCache',
      'txHeightCache',
      'missingHeaders',
      'serverStates',
      'fetchingTxs',
      'missingTxs',
      'fetchingHeaders'
    ]
    const pluginCache = ['headerCache', 'serverCache', 'servers_']

    engineCache.forEach(c => add(c, 'engineState'))
    pluginCache.forEach(c => add(c, 'pluginState'))

    return dataDump
  }
}
