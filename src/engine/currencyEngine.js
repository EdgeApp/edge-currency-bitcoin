// @flow
import type {
  EdgeTransaction,
  EdgeWalletInfo,
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyEngineCallbacks,
  EdgeGetTransactionsOptions,
  EdgePaymentProtocolInfo,
  EdgeFreshAddress,
  EdgeSpendInfo,
  EdgeSpendTarget,
  EdgeDataDump,
  EdgeIo,
  DiskletFolder
} from 'edge-core-js'

import { EngineState } from './engineState.js'
import { PluginState } from '../plugin/pluginState.js'
import { KeyManager } from './keyManager'
import type { EngineStateCallbacks } from './engineState.js'
import type { KeyManagerCallbacks } from './keyManager'
import type { EarnComFees, BitcoinFees } from '../utils/flowTypes.js'
import type { TxOptions } from '../utils/coinUtils.js'
import { validateObject, promiseAny } from '../utils/utils.js'
import {
  getPaymentDetails,
  createPayment,
  sendPayment
} from './paymentRequest.js'
import { InfoServerFeesSchema } from '../utils/jsonSchemas.js'
import { calcFeesFromEarnCom, calcMinerFeePerByte } from './miningFees.js'
import { broadcastFactories } from './broadcastApi.js'
import { bns } from 'biggystring'
import { getAllAddresses } from '../utils/formatSelector.js'
import { InfoServer } from '../info/constants'
import {
  addressToScriptHash,
  verifyTxAmount,
  sumUtxos
} from '../utils/coinUtils.js'
import {
  toLegacyFormat,
  toNewFormat,
  validAddress
} from '../utils/addressFormat/addressFormatIndex.js'

const BYTES_TO_KB = 1000
const MILLI_TO_SEC = 1000

export function snooze (ms: number): Promise<void> {
  return new Promise((resolve: any) => setTimeout(resolve, ms))
}

export type EngineCurrencyInfo = {
  // Required Settings
  network: string, // The offical network in lower case - Needs to match the Bitcoin Lib Network Type
  currencyCode: string, // The offical currency code in upper case - Needs to match the EdgeCurrencyInfo currencyCode
  gapLimit: number,
  maxFee: number,
  defaultFee: number,
  feeUpdateInterval: number,
  customFeeSettings: Array<string>,
  simpleFeeSettings: {
    highFee: string,
    lowFee: string,
    standardFeeLow: string,
    standardFeeHigh: string,
    standardFeeLowAmount: string,
    standardFeeHighAmount: string
  },

  // Optional Settings
  forks?: Array<string>,
  feeInfoServer?: string
}

export type CurrencyEngineSettings = {
  walletInfo: EdgeWalletInfo,
  engineInfo: EngineCurrencyInfo,
  pluginState: PluginState,
  options: EdgeCurrencyEngineOptions,
  io: EdgeIo
}
/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyEngine {
  walletInfo: EdgeWalletInfo
  walletId: string
  engineInfo: EngineCurrencyInfo
  currencyCode: string
  network: string
  keyManager: KeyManager
  engineState: EngineState
  pluginState: PluginState
  callbacks: EdgeCurrencyEngineCallbacks
  walletLocalFolder: DiskletFolder
  walletLocalEncryptedFolder: DiskletFolder
  io: EdgeIo
  feeUpdateInterval: number
  feeTimer: any
  fees: BitcoinFees

  // ------------------------------------------------------------------------
  // Private API
  // ------------------------------------------------------------------------
  constructor ({
    walletInfo,
    engineInfo,
    pluginState,
    options,
    io
  }: CurrencyEngineSettings) {
    // Validate that we are a valid EdgeCurrencyEngine:
    // eslint-disable-next-line no-unused-vars
    const test: EdgeCurrencyEngine = this
    this.walletInfo = walletInfo
    this.walletId = walletInfo.id || ''
    this.pluginState = pluginState
    this.callbacks = options.callbacks
    this.walletLocalFolder = options.walletLocalFolder
    this.walletLocalEncryptedFolder = options.walletLocalEncryptedFolder
    this.io = io
    this.engineInfo = engineInfo
    this.feeUpdateInterval = this.engineInfo.feeUpdateInterval
    this.currencyCode = this.engineInfo.currencyCode
    this.network = this.engineInfo.network

    this.fees = { ...engineInfo.simpleFeeSettings, timestamp: 0 }
  }

  async load (): Promise<any> {
    const engineStateCallbacks: EngineStateCallbacks = {
      onHeightUpdated: this.callbacks.onBlockHeightChanged,
      onTxFetched: (txid: string) => {
        this.getTransaction(txid).then(edgeTransaction => {
          this.callbacks.onTransactionsChanged([edgeTransaction])
        })
      },
      onAddressesChecked: this.callbacks.onAddressesChecked
    }

    this.engineState = new EngineState({
      files: { txs: 'txs.json', addresses: 'addresses.json' },
      callbacks: engineStateCallbacks,
      io: this.io,
      localFolder: this.walletLocalFolder,
      encryptedLocalFolder: this.walletLocalEncryptedFolder,
      pluginState: this.pluginState,
      walletId: this.walletId
    })

    await this.engineState.load()

    const callbacks: KeyManagerCallbacks = {
      onNewAddress: (scriptHash: string, address: string, path: string) => {
        return this.engineState.addAddress(scriptHash, address, path)
      },
      onNewKey: (keys: any) => this.engineState.saveKeys(keys)
    }

    const cachedRawKeys = await this.engineState.loadKeys()
    const { master = {}, ...otherKeys } = cachedRawKeys || {}
    const keys = this.walletInfo.keys || {}
    const { format, coinType = -1 } = keys
    const seed = keys[`${this.network}Key`]
    const xpub = keys[`${this.network}Xpub`]
    const rawKeys = { ...otherKeys, master: { xpub, ...master } }

    console.log(
      `${this.walletId} - Created Wallet Type ${format} for Currency Plugin ${
        this.pluginState.pluginName
      }`
    )

    this.keyManager = new KeyManager({
      seed: seed,
      bip: format,
      coinType: coinType,
      rawKeys: rawKeys,
      callbacks: callbacks,
      gapLimit: this.engineInfo.gapLimit,
      network: this.network,
      addressInfos: this.engineState.addressInfos,
      txInfos: this.engineState.parsedTxs
    })

    this.engineState.onAddressUsed = () => {
      this.keyManager.setLookAhead()
    }

    this.engineState.onBalanceChanged = () => {
      this.callbacks.onBalanceChanged(this.currencyCode, this.getBalance())
    }

    await this.keyManager.load()
  }

  async getTransaction (txid: string): Promise<EdgeTransaction> {
    await snooze(3) // Give up a tick so some GUI rendering can happen
    const { height = -1, firstSeen = Date.now() / 1000 } =
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
    let type = null

    // Process tx outputs
    const outputsLength = bcoinTransaction.outputs.length
    for (let i = 0; i < outputsLength; i++) {
      output = bcoinTransaction.outputs[i]
      type = output.getType()
      if (type === 'nonstandard' || type === 'nulldata') {
        continue
      }
      output = output.getJSON(this.network)
      value = output.value
      try {
        address = toNewFormat(output.address, this.network)
      } catch (e) {
        console.log(e)
        if (value <= 0) {
          continue
        } else {
          address = ''
        }
      }
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
    const edgeTransaction: EdgeTransaction = {
      ourReceiveAddresses,
      currencyCode: this.currencyCode,
      otherParams: {},
      txid: txid,
      date: date,
      blockHeight: height,
      nativeAmount: `${nativeAmount}`,
      networkFee: `${fee}`,
      signedTx: this.engineState.txCache[txid]
    }
    return edgeTransaction
  }

  async updateFeeTable () {
    try {
      await this.fetchFee()
      if (Date.now() - this.fees.timestamp > this.feeUpdateInterval) {
        const url = `${InfoServer}/networkFees/${this.currencyCode}`
        const feesResponse = await this.io.fetch(url)
        const feesJson = await feesResponse.json()
        this.fees.timestamp = Date.now()
        if (validateObject(feesJson, InfoServerFeesSchema)) {
          this.fees = feesJson
        } else {
          throw new Error('Fetched invalid networkFees')
        }
      }
    } catch (err) {
      console.log(`${this.walletId} - ${err.toString()}`)
    }
  }

  async fetchFee () {
    const { feeInfoServer } = this.engineInfo
    if (!feeInfoServer || feeInfoServer === '') {
      clearTimeout(this.feeTimer)
      return
    }
    try {
      if (Date.now() - this.fees.timestamp > this.feeUpdateInterval) {
        const results = await this.io.fetch(feeInfoServer)
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
    customNetworkFee = {},
    otherParams
  }: EdgeSpendInfo): number {
    if (
      otherParams &&
      otherParams.paymentProtocolInfo &&
      otherParams.paymentProtocolInfo.merchant &&
      otherParams.paymentProtocolInfo.merchant.requiredFeeRate
    ) {
      const requiredFeeRate =
        otherParams.paymentProtocolInfo.merchant.requiredFeeRate
      return Math.ceil(parseFloat(requiredFeeRate) * BYTES_TO_KB * 1.5)
    }
    const customFeeSetting = this.engineInfo.customFeeSettings[0]
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

  logEdgeTransaction (edgeTransaction: EdgeTransaction, action: string) {
    let log = `------------------ ${action} Transaction ------------------\n`
    log += `Transaction id: ${edgeTransaction.txid}\n`
    log += `Our Receiving addresses are: ${edgeTransaction.ourReceiveAddresses.toString()}\n`
    log += 'Transaction details:\n'
    if (edgeTransaction.otherParams && edgeTransaction.otherParams.bcoinTx) {
      const jsonObj = edgeTransaction.otherParams.bcoinTx.getJSON(this.network)
      log += JSON.stringify(jsonObj, null, 2) + '\n'
    }
    log += '------------------------------------------------------------------'
    console.log(`${this.walletId} - ${log}`)
  }
  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------
  async startEngine (): Promise<void> {
    this.callbacks.onBalanceChanged(this.currencyCode, this.getBalance())
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
    return this.engineState.getBalance()
  }

  getNumTransactions (options: any): number {
    return this.engineState.getNumTransactions(options)
  }

  async getTransactions (
    options: EdgeGetTransactionsOptions
  ): Promise<Array<EdgeTransaction>> {
    const rawTxs = this.engineState.txCache
    const edgeTransactions = []
    for (const txid in rawTxs) {
      const edgeTransaction = await this.getTransaction(txid)
      edgeTransactions.push(edgeTransaction)
    }

    const startIndex = (options && options.startIndex) || 0
    let endIndex =
      (options && options.startEntries + startIndex) || edgeTransactions.length
    if (startIndex + endIndex > edgeTransactions.length) {
      endIndex = edgeTransactions.length
    }
    return edgeTransactions.slice(startIndex, endIndex)
  }

  getFreshAddress (options: any): EdgeFreshAddress {
    const publicAddress = this.keyManager.getReceiveAddress()
    const legacyAddress = toLegacyFormat(publicAddress, this.network)
    return { publicAddress, legacyAddress }
  }

  addGapLimitAddresses (addresses: Array<string>, options: any): void {
    const scriptHashPromises = addresses.map(address => {
      const scriptHash = this.engineState.scriptHashes[address]
      if (typeof scriptHash === 'string') return Promise.resolve(scriptHash)
      else return addressToScriptHash(address, this.network)
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

  async sweepPrivateKeys (
    edgeSpendInfo: EdgeSpendInfo,
    options?: any = {}
  ): Promise<EdgeTransaction> {
    const { privateKeys = [] } = edgeSpendInfo
    if (!privateKeys.length) throw new Error('No private keys given')
    let success, failure
    const end = new Promise((resolve, reject) => {
      success = resolve
      failure = reject
    })
    const engineStateCallbacks: EngineStateCallbacks = {
      onAddressesChecked: (ratio: number) => {
        if (ratio === 1) {
          engineState.disconnect()
          options.subtractFee = true
          const utxos = engineState.getUTXOs()
          if (!utxos || !utxos.length) {
            failure(new Error('Private key has no funds'))
          }
          const publicAddress = this.getFreshAddress().publicAddress
          const nativeAmount = engineState.getBalance()
          options.utxos = utxos
          edgeSpendInfo.spendTargets = [{ publicAddress, nativeAmount }]
          this.makeSpend(edgeSpendInfo, options)
            .then(tx => success(tx))
            .catch(e => failure(e))
        }
      }
    }

    const engineState = new EngineState({
      files: { txs: '', addresses: '' },
      callbacks: engineStateCallbacks,
      io: this.io,
      localFolder: this.walletLocalFolder,
      encryptedLocalFolder: this.walletLocalEncryptedFolder,
      pluginState: this.pluginState,
      walletId: this.walletId
    })

    await engineState.load()
    const addresses = await getAllAddresses(privateKeys, this.network)
    addresses.forEach(({ address, scriptHash }) =>
      engineState.addAddress(scriptHash, address)
    )
    engineState.connect()

    return end
  }

  async getPaymentProtocolInfo (
    paymentProtocolURL: string
  ): Promise<EdgePaymentProtocolInfo> {
    try {
      return getPaymentDetails(
        paymentProtocolURL,
        this.network,
        this.currencyCode,
        this.io.fetch
      )
    } catch (err) {
      console.log(`${this.walletId} - ${err.toString()}`)
      throw err
    }
  }

  async makeSpend (
    edgeSpendInfo: EdgeSpendInfo,
    txOptions?: TxOptions = {}
  ): Promise<EdgeTransaction> {
    const { spendTargets } = edgeSpendInfo
    // Can't spend without outputs
    if (!txOptions.CPFP && (!spendTargets || spendTargets.length < 1)) {
      throw new Error('Need to provide Spend Targets')
    }
    // Calculate the total amount to send
    const totalAmountToSend = spendTargets.reduce(
      (sum, { nativeAmount }) => bns.add(sum, nativeAmount || '0'),
      '0'
    )
    // Try and get UTXOs from `txOptions`, if unsuccessful use our own utxo's
    const { utxos = this.engineState.getUTXOs() } = txOptions
    // Test if we have enough to spend
    if (bns.gt(totalAmountToSend, `${sumUtxos(utxos)}`)) {
      throw new Error('InsufficientFundsError')
    }
    try {
      // If somehow we have outdated fees, try and get new ones
      if (Date.now() - this.fees.timestamp > this.feeUpdateInterval) {
        await this.updateFeeTable()
      }
      // Get the rate according to the latest fee
      const rate = this.getRate(edgeSpendInfo)
      // Create outputs from spendTargets
      const outputs = spendTargets
        .filter(
          ({ publicAddress, nativeAmount }) => publicAddress && nativeAmount
        )
        .map(({ publicAddress = '', nativeAmount = 0 }) => ({
          address: publicAddress.toString(),
          value: parseInt(nativeAmount)
        }))

      const bcoinTx = await this.keyManager.createTX({
        outputs,
        utxos,
        rate,
        txOptions,
        maxFee: this.engineInfo.maxFee,
        height: this.getBlockHeight()
      })

      const { scriptHashes } = this.engineState
      const sumOfTx = spendTargets.reduce(
        (s, { publicAddress, nativeAmount }: EdgeSpendTarget) =>
          publicAddress && scriptHashes[publicAddress]
            ? s
            : s - parseInt(nativeAmount),
        0
      )

      const ourReceiveAddresses = []
      for (const i in bcoinTx.outputs) {
        let address = bcoinTx.outputs[i].getAddress().toString(this.network)
        address = toNewFormat(address, this.network)
        if (address && scriptHashes[address]) {
          ourReceiveAddresses.push(address)
        }
      }

      const edgeTransaction: EdgeTransaction = {
        ourReceiveAddresses,
        otherParams: { bcoinTx, edgeSpendInfo, rate },
        currencyCode: this.currencyCode,
        txid: '',
        date: 0,
        blockHeight: 0,
        nativeAmount: `${sumOfTx - parseInt(bcoinTx.getFee())}`,
        networkFee: `${bcoinTx.getFee()}`,
        signedTx: ''
      }
      return edgeTransaction
    } catch (e) {
      if (e.type === 'FundingError') throw new Error('InsufficientFundsError')
      throw e
    }
  }

  async signTx (edgeTransaction: EdgeTransaction): Promise<EdgeTransaction> {
    this.logEdgeTransaction(edgeTransaction, 'Signing')
    const { edgeSpendInfo, bcoinTx } = edgeTransaction.otherParams || {}
    const { privateKeys = [], otherParams = {} } = edgeSpendInfo
    const { paymentProtocolInfo } = otherParams
    const { signedTx, txid } = await this.keyManager.sign(bcoinTx, privateKeys)
    if (paymentProtocolInfo) {
      const publicAddress = this.getFreshAddress().publicAddress
      const address = toLegacyFormat(publicAddress, this.network)
      const payment = createPayment(
        paymentProtocolInfo,
        address,
        signedTx,
        this.currencyCode
      )
      Object.assign(edgeTransaction.otherParams, {
        paymentProtocolInfo: { ...paymentProtocolInfo, payment }
      })
    }
    return {
      ...edgeTransaction,
      signedTx,
      txid,
      date: Date.now() / MILLI_TO_SEC
    }
  }

  async broadcastTx (
    edgeTransaction: EdgeTransaction
  ): Promise<EdgeTransaction> {
    const { otherParams = {}, signedTx, currencyCode } = edgeTransaction

    const { bcoinTx, paymentProtocolInfo } = otherParams
    if (paymentProtocolInfo && paymentProtocolInfo.payment) {
      const paymentAck = await sendPayment(
        this.io.fetch,
        this.network,
        paymentProtocolInfo.paymentUrl,
        paymentProtocolInfo.payment
      )
      if (!paymentAck) {
        throw new Error(
          `Error when sending to ${paymentProtocolInfo.paymentUrl}`
        )
      }
    }

    const tx = verifyTxAmount(signedTx, bcoinTx)
    if (!tx) throw new Error('Wrong spend amount')
    edgeTransaction.otherParams.bcoinTx = tx
    this.logEdgeTransaction(edgeTransaction, 'Broadcasting')

    // Try APIs
    const promiseArray = []
    if (!this.pluginState.disableFetchingServers) {
      for (const broadcastFactory of broadcastFactories) {
        const broadcaster = broadcastFactory(this.io, currencyCode)
        if (broadcaster) promiseArray.push(broadcaster(signedTx))
      }
    }

    promiseArray.push(this.engineState.broadcastTx(signedTx))
    await promiseAny(promiseArray)
    return edgeTransaction
  }

  saveTx (edgeTransaction: EdgeTransaction): Promise<void> {
    this.logEdgeTransaction(edgeTransaction, 'Saving')
    this.engineState.saveTx(edgeTransaction.txid, edgeTransaction.signedTx)
    return Promise.resolve()
  }

  getDisplayPrivateSeed (): string | null {
    return this.keyManager ? this.keyManager.getSeed() : null
  }

  getDisplayPublicSeed (): string | null {
    return this.keyManager ? this.keyManager.getPublicSeed() : null
  }

  dumpData (): EdgeDataDump {
    return {
      walletId: this.walletId.split(' - ')[0],
      walletType: this.walletInfo.type,
      walletFormat: this.walletInfo.keys && this.walletInfo.keys.format,
      pluginType: this.pluginState.pluginName,
      fees: this.fees,
      data: {
        ...this.pluginState.dumpData(),
        ...this.engineState.dumpData()
      }
    }
  }
}
