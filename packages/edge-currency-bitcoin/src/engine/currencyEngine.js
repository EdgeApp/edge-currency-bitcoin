// @flow

import { bns } from 'biggystring'
import { type Disklet } from 'disklet'
import {
  type EdgeCurrencyEngine,
  type EdgeCurrencyEngineCallbacks,
  type EdgeDataDump,
  type EdgeFreshAddress,
  type EdgeGetTransactionsOptions,
  type EdgePaymentProtocolInfo,
  type EdgeSpendInfo,
  type EdgeSpendTarget,
  type EdgeTransaction,
  type EdgeWalletInfo
} from 'edge-core-js/types'

import { type TxOptions } from '../../types/bcoinUtils.js'
import {
  type CurrencyEngineSettings,
  type EngineCurrencyInfo,
  type EngineStateCallbacks
} from '../../types/engine.js'
import { type BitcoinFees, type EarnComFees } from '../../types/fees.js'
import { type PluginIo } from '../../types/plugin.js'
import { PluginState } from '../plugin/pluginState.js'
import { isValidAddress } from '../utils/addressFormat/addressFormatIndex.js'
import * as Address from '../utils/bcoinUtils/address.js'
import {
  formatToBips,
  scriptTypesToEdgeTypes
} from '../utils/bcoinUtils/misc.js'
import * as PaymentRequest from '../utils/bcoinUtils/paymentRequest.js'
import * as Tx from '../utils/bcoinUtils/tx.js'
import { InfoServerFeesSchema, EarnComFeesSchema } from '../utils/jsonSchemas.js'
import { envSettings, promiseAny, validateObject } from '../utils/utils.js'
import { broadcastFactories } from './broadcastApi.js'
import { EngineState } from './engineState.js'
import { KeyManager } from './keyManager'
import { calcFeesFromEarnCom, calcMinerFeePerByte } from './miningFees.js'

const BYTES_TO_KB = 1000
const MILLI_TO_SEC = 1000

export function snooze (ms: number): Promise<void> {
  return new Promise((resolve: any) => setTimeout(resolve, ms))
}

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyEngine {
  walletInfo: EdgeWalletInfo
  walletId: string
  prunedWalletId: string
  engineInfo: EngineCurrencyInfo
  currencyCode: string
  network: string
  keyManager: KeyManager
  engineState: EngineState
  pluginState: PluginState
  callbacks: EdgeCurrencyEngineCallbacks
  walletLocalDisklet: Disklet
  walletLocalEncryptedDisklet: Disklet
  io: PluginIo
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
    this.prunedWalletId = this.walletId.slice(0, 6)
    this.pluginState = pluginState
    this.callbacks = options.callbacks
    this.walletLocalDisklet = options.walletLocalDisklet
    this.walletLocalEncryptedDisklet = options.walletLocalEncryptedDisklet
    this.io = io
    this.engineInfo = engineInfo
    this.feeUpdateInterval = this.engineInfo.feeUpdateInterval
    this.currencyCode = this.engineInfo.currencyCode
    this.network = this.engineInfo.network

    this.fees = { ...engineInfo.simpleFeeSettings, timestamp: 0 }
    console.log(
      `${this.prunedWalletId}: create engine type: ${this.walletInfo.type}`
    )
    const callbacks: EngineStateCallbacks = {
      onHeightUpdated: this.callbacks.onBlockHeightChanged,
      onTxFetched: (txid: string) => {
        const edgeTransaction = this.getTransactionSync(txid)
        this.callbacks.onTransactionsChanged([edgeTransaction])
      },
      onAddressesChecked: this.callbacks.onAddressesChecked
    }

    this.engineState = new EngineState({
      callbacks,
      io,
      pluginState,
      localDisklet: this.walletLocalDisklet,
      encryptedLocalDisklet: this.walletLocalEncryptedDisklet,
      walletId: this.prunedWalletId
    })

    const keys = this.walletInfo.keys || {}
    const { format, coinType = 0 } = keys
    const bips = formatToBips(this.network, format)
    const seed = keys[`${this.network}Key`]
    const xpub = keys[`${this.network}Xpub`]

    this.keyManager = new KeyManager({
      seed,
      xpub,
      coinType,
      bips,
      gapLimit: envSettings.gapLimit,
      network: this.network,
      masterKey: this.engineState.masterKey,
      addressInfos: this.engineState.addressInfos,
      scriptHashes: this.engineState.scriptHashes,
      scriptHashesMap: this.engineState.scriptHashesMap,
      txInfos: this.engineState.parsedTxs
    })

    console.log(
      `${this.walletId} - Created Wallet for Currency Plugin ${
        this.pluginState.pluginName
      }`
    )
  }

  async load (): Promise<any> {
    await this.engineState.load()

    this.keyManager.on(
      'newAddress',
      this.engineState.addAddress,
      this.engineState
    )

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
    return this.getTransactionSync(txid)
  }

  getTransactionSync (txid: string): EdgeTransaction {
    const { height = -1, firstSeen = Date.now() / 1000 } =
      this.engineState.txHeights[txid] || {}
    let date = firstSeen
    // If confirmed, we will try and take the timestamp as the date
    if (height && height !== -1) {
      const blockHeight = this.pluginState.headers[`${height}`]
      if (blockHeight) {
        date = blockHeight.timestamp
      }
    }
    // Get parsed bcoin tx from engine
    const bcoinTransaction = this.engineState.parsedTxs[txid]
    if (!bcoinTransaction) {
      throw new Error('Transaction not found')
    }

    const { fee, ourReceiveAddresses, nativeAmount } = Tx.sumTransaction(
      bcoinTransaction,
      this.network,
      this.engineState
    )

    const edgeTransaction: EdgeTransaction = {
      ourReceiveAddresses,
      currencyCode: this.currencyCode,
      otherParams: {},
      txid: txid,
      date: date,
      blockHeight: height === -1 ? 0 : height,
      nativeAmount: `${nativeAmount}`,
      networkFee: `${fee}`,
      signedTx: this.engineState.txs[txid]
    }
    return edgeTransaction
  }

  async updateFeeFromEdge () {
    try {
      const url = `${InfoServer}/networkFees/${this.currencyCode}`
      const feesResponse = await this.io.fetch(url)
      const feesJson = await feesResponse.json()
      if (validateObject(feesJson, InfoServerFeesSchema)) {
        this.fees = { ...this.fees, ...feesJson }
      } else {
        throw new Error('Fetched invalid networkFees')
      }
    } catch (err) {
      console.log(`${this.prunedWalletId} - ${err.toString()}`)
    }
  }

  async updateFeeFromVendor () {
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
        const feesJson: EarnComFees = await results.json()
        if (validateObject(feesJson, EarnComFeesSchema)) {
          const newFees = calcFeesFromEarnCom(feesJson.fees)
          this.fees = { ...this.fees, ...newFees }
          this.fees.timestamp = Date.now()
        } else {
          throw new Error('Fetched invalid networkFees')
        }
      }
    } catch (e) {
      console.log(
        `${
          this.prunedWalletId
        } - Error while trying to update fee table ${e.toString()}`
      )
    }
    this.feeTimer = setTimeout(
      () => this.updateFeeFromVendor(),
      this.feeUpdateInterval
    )
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
    if (edgeTransaction.otherParams && edgeTransaction.otherParams.txJson) {
      log += JSON.stringify(edgeTransaction.otherParams.txJson, null, 2) + '\n'
    }
    log += '------------------------------------------------------------------'
    console.log(`${this.prunedWalletId}: ${log}`)
  }
  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------
  async changeUserSettings (userSettings: Object): Promise<mixed> {
    await this.pluginState.updateServers(userSettings)
  }

  async startEngine (): Promise<void> {
    this.callbacks.onBalanceChanged(this.currencyCode, this.getBalance())
    this.updateFeeFromVendor()
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
    return this.pluginState.height.latest
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
    const rawTxs = this.engineState.txs
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
    return scriptTypesToEdgeTypes(
      this.keyManager.getReceiveAddress(),
      this.network
    )
  }

  addGapLimitAddresses (addresses: Array<string>, options: any): void {
    const scriptHashPromises = addresses.map(address => {
      const scriptHash = this.engineState.scriptHashes[address]
      if (typeof scriptHash === 'string') return Promise.resolve(scriptHash)
      else {
        const rawAddress = Address.fromBaseString(address, this.network)
        return Address.toScriptHash(rawAddress)
      }
    })
    Promise.all(scriptHashPromises)
      .then((scriptHashs: Array<string>) => {
        this.engineState.markAddressesUsed(scriptHashs)
        if (this.keyManager) this.keyManager.setLookAhead()
      })
      .catch(e => console.log(`${this.prunedWalletId}: ${e.toString()}`))
  }

  isAddressUsed (address: string, options: any): boolean {
    if (!isValidAddress(address, this.network)) {
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
          const freshAddress = this.getFreshAddress()
          const publicAddress = freshAddress.publicAddress
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
      callbacks: engineStateCallbacks,
      io: this.io,
      localDisklet: this.walletLocalDisklet,
      encryptedLocalDisklet: this.walletLocalEncryptedDisklet,
      pluginState: this.pluginState,
      walletId: this.prunedWalletId
    })

    const addresses = await Address.getAllAddresses(privateKeys, this.network)
    addresses.forEach(({ displayAddress, scriptHash }) =>
      engineState.addAddress(scriptHash, displayAddress, 'm')
    )
    engineState.connect()

    return end
  }

  async getPaymentProtocolInfo (
    paymentProtocolURL: string
  ): Promise<EdgePaymentProtocolInfo> {
    try {
      return PaymentRequest.getPaymentDetails(
        paymentProtocolURL,
        this.network,
        this.currencyCode,
        this.io.fetch
      )
    } catch (err) {
      console.log(`${this.prunedWalletId} - ${err.toString()}`)
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
    if (bns.gt(totalAmountToSend, `${Tx.sumUtxos(utxos)}`)) {
      throw new Error('InsufficientFundsError')
    }
    try {
      // If somehow we have outdated fees, try and get new ones
      if (Date.now() - this.fees.timestamp > this.feeUpdateInterval) {
        await this.updateFeeTable()
      }
      // Get the rate according to the latest fee
      const rate = this.getRate(edgeSpendInfo)
      this.io.console.info(`spend: Using fee rate ${rate} sat/K`)
      // Create outputs from spendTargets

      const outputs = []
      for (const spendTarget of spendTargets) {
        const {
          publicAddress: address,
          nativeAmount,
          otherParams: { script } = {}
        } = spendTarget
        const value = parseInt(nativeAmount || '0')
        if (address && nativeAmount) outputs.push({ address, value })
        else if (script) outputs.push({ script, value })
      }

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

      const addresses = Tx.getReceiveAddresses(bcoinTx, this.network)

      const ourReceiveAddresses = addresses.filter(
        address => scriptHashes[address]
      )

      const edgeTransaction: EdgeTransaction = {
        ourReceiveAddresses,
        otherParams: {
          txJson: bcoinTx.getJSON(this.network),
          edgeSpendInfo,
          rate
        },
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
    const { edgeSpendInfo, txJson, signMessage } =
      edgeTransaction.otherParams || {}
    if (signMessage) {
      const { signature, publicKey } = await this.keyManager.signMessage(
        signMessage
      )
      const signedMessage = { ...signMessage, signature, publicKey }
      const otherParams = {
        ...edgeTransaction.otherParams,
        signMessage: signedMessage
      }
      return { ...edgeTransaction, otherParams }
    }
    this.logEdgeTransaction(edgeTransaction, 'Signing')
    const bcoinTx = Tx.parseJsonTransaction(txJson)
    const { privateKeys = [], otherParams = {} } = edgeSpendInfo
    const { paymentProtocolInfo } = otherParams
    const { signedTx, txid } = await this.keyManager.sign(bcoinTx, privateKeys)
    if (paymentProtocolInfo) {
      const payment = { currency: this.currencyCode, transactions: [signedTx] }
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
    const { paymentProtocolInfo } = otherParams

    if (paymentProtocolInfo && paymentProtocolInfo.payment) {
      const paymentAck = await PaymentRequest.sendPayment(
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

    const tx = Tx.verifyTxAmount(signedTx)
    if (!tx) throw new Error('Wrong spend amount')
    edgeTransaction.otherParams.txJson = tx.getJSON(this.network)
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
