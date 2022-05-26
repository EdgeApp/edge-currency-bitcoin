// @flow

import { bns } from 'biggystring'
import { type Disklet } from 'disklet'
import {
  type EdgeCurrencyEngine,
  type EdgeCurrencyEngineCallbacks,
  type EdgeCurrencyEngineOptions,
  type EdgeDataDump,
  type EdgeFreshAddress,
  type EdgeGetTransactionsOptions,
  type EdgeLog,
  type EdgePaymentProtocolInfo,
  type EdgeSpendInfo,
  type EdgeSpendTarget,
  type EdgeTransaction,
  type EdgeWalletInfo,
  InsufficientFundsError
} from 'edge-core-js/types'

import { InfoServer } from '../info/constants'
import { type PluginIo } from '../plugin/pluginIo.js'
import { PluginState } from '../plugin/pluginState.js'
import { toLegacyFormat, validAddress } from '../utils/addressFormat.js'
import type { TxOptions } from '../utils/coinUtils.js'
import {
  addressToScriptHash,
  getReceiveAddresses,
  parseJsonTransaction,
  signBitcoinMessage,
  sumTransaction,
  sumUtxos,
  verifyTxAmount
} from '../utils/coinUtils.js'
import type { BitcoinFees, EarnComFees } from '../utils/flowTypes.js'
import { getAllAddresses } from '../utils/formatSelector.js'
import {
  EarnComFeesSchema,
  InfoServerFeesSchema
} from '../utils/jsonSchemas.js'
import { promiseAny, validateObject } from '../utils/utils.js'
import { broadcastFactories } from './broadcastApi.js'
import type { EngineStateCallbacks } from './engineState.js'
import { EngineState } from './engineState.js'
import type { KeyManagerCallbacks } from './keyManager'
import { KeyManager } from './keyManager'
import {
  asMempoolSpaceResult,
  calcFeesFromEarnCom,
  calcFeesFromMempoolSpace,
  calcMinerFeePerByte
} from './miningFees.js'
import {
  createPayment,
  getPaymentDetails,
  sendPayment
} from './paymentRequest.js'

const BYTES_TO_KB = 1000
const MILLI_TO_SEC = 1000

export function snooze(ms: number): Promise<void> {
  return new Promise((resolve: any) => setTimeout(resolve, ms))
}

export type EngineCurrencyInfo = {
  // Required Settings
  network: string, // The offical network in lower case - Needs to match the Bitcoin Lib Network Type
  currencyCode: string, // The offical currency code in upper case - Needs to match the EdgeCurrencyInfo currencyCode
  gapLimit: number,
  defaultFee: number,
  feeUpdateInterval: number,
  customFeeSettings: string[],
  simpleFeeSettings: {
    highFee: string,
    lowFee: string,
    standardFeeLow: string,
    standardFeeHigh: string,
    standardFeeLowAmount: string,
    standardFeeHighAmount: string
  },

  // Optional Settings
  forks?: string[],
  minRelay?: number,
  earnComFeeInfoServer?: string,
  mempoolSpaceFeeInfoServer?: string,
  timestampFromHeader?: (header: Buffer, height: number) => number,
  instantlock?: boolean
}

export type CurrencyEngineSettings = {
  walletInfo: EdgeWalletInfo,
  engineInfo: EngineCurrencyInfo,
  pluginState: PluginState,
  options: EdgeCurrencyEngineOptions,
  io: PluginIo
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
  log: EdgeLog
  feeUpdateInterval: number
  feeTimer: any
  fees: BitcoinFees
  otherMethods: Object

  // ------------------------------------------------------------------------
  // Private API
  // ------------------------------------------------------------------------
  constructor({
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
    this.log = options.log
    this.engineInfo = engineInfo
    this.feeUpdateInterval = this.engineInfo.feeUpdateInterval
    this.currencyCode = this.engineInfo.currencyCode
    this.network = this.engineInfo.network

    this.fees = { ...engineInfo.simpleFeeSettings, timestamp: 0 }
    this.log(
      `${this.prunedWalletId}: create engine type: ${this.walletInfo.type}`
    )

    this.otherMethods = {
      signMessageBase64: async (
        message: string,
        address: string
      ): Promise<string> => {
        const key = await this.keyManager.getKeyForAddress(address)
        const signature = await signBitcoinMessage(message, key)
        return signature
      }
    }
  }

  async load(): Promise<any> {
    const engineStateCallbacks: EngineStateCallbacks = {
      onHeightUpdated: this.callbacks.onBlockHeightChanged,
      onTxFetched: (txid: string) => {
        const edgeTransaction = this.getTransactionSync(txid)
        this.callbacks.onTransactionsChanged([edgeTransaction])
      },
      onAddressesChecked: this.callbacks.onAddressesChecked
    }

    this.engineState = new EngineState({
      files: { txs: 'txs.json', addresses: 'addresses.json' },
      callbacks: engineStateCallbacks,
      io: this.io,
      log: this.log,
      localDisklet: this.walletLocalDisklet,
      encryptedLocalDisklet: this.walletLocalEncryptedDisklet,
      pluginState: this.pluginState,
      walletId: this.prunedWalletId,
      engineInfo: this.engineInfo
    })

    await this.engineState.load()

    const callbacks: KeyManagerCallbacks = {
      onNewAddress: (
        scriptHash: string,
        address: string,
        path: string,
        redeemScript?: string
      ) => {
        return this.engineState.addAddress(
          scriptHash,
          address,
          path,
          redeemScript
        )
      },
      onNewKey: (keys: any) => this.engineState.saveKeys(keys)
    }

    const cachedRawKeys = await this.engineState.loadKeys()
    // $FlowFixMe master is missing in object literal
    const { master = {}, ...otherKeys } = cachedRawKeys || {}
    const keys = this.walletInfo.keys || {}
    const { format, coinType = -1 } = keys
    const seed = keys[`${this.network}Key`]
    const xpub = keys[`${this.network}Xpub`]
    const rawKeys = { ...otherKeys, master: { xpub, ...master } }

    this.log(
      `${this.walletId} - Created Wallet Type ${format} for Currency Plugin ${this.pluginState.pluginId}`
    )

    this.keyManager = new KeyManager({
      seed: seed,
      bip: format,
      coinType: coinType,
      rawKeys: rawKeys,
      callbacks: callbacks,
      gapLimit: this.engineInfo.gapLimit,
      network: this.network,
      engineState: this.engineState,
      log: this.log
    })

    this.engineState.onAddressUsed = () => {
      this.keyManager.setLookAhead()
    }

    this.engineState.onBalanceChanged = () => {
      this.callbacks.onBalanceChanged(this.currencyCode, this.getBalance())
    }

    await this.keyManager.load()
  }

  async getTransaction(txid: string): Promise<EdgeTransaction> {
    await snooze(3) // Give up a tick so some GUI rendering can happen
    return this.getTransactionSync(txid)
  }

  getTransactionSync(txid: string): EdgeTransaction {
    const {
      instantlock = false,
      height = -1,
      firstSeen = Date.now() / 1000
    } = this.engineState.txHeightCache[txid] || {}
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

    const { fee, ourReceiveAddresses, nativeAmount } = sumTransaction(
      bcoinTransaction,
      this.network,
      this.engineState
    )
    const sizes = bcoinTransaction.getSizes()
    const debugInfo = `Inputs: ${bcoinTransaction.inputs.length}\nOutputs: ${bcoinTransaction.outputs.length}\nSize: ${sizes.size}\nWitness: ${sizes.witness}`
    const edgeTransaction: EdgeTransaction = {
      ourReceiveAddresses,
      currencyCode: this.currencyCode,
      otherParams: {
        debugInfo
      },
      txid: txid,
      date: date,
      blockHeight: height !== -1 ? height : instantlock ? 1 : 0,
      nativeAmount: `${nativeAmount}`,
      networkFee: `${fee}`,
      signedTx: this.engineState.txCache[txid]
    }
    return edgeTransaction
  }

  async updateFeeFromEdge() {
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
      this.log.error(`${this.prunedWalletId} - ${err.toString()}`)
    }
  }

  async updateFeeFromVendor() {
    const { earnComFeeInfoServer, mempoolSpaceFeeInfoServer } = this.engineInfo
    let success = false
    if (!earnComFeeInfoServer && !mempoolSpaceFeeInfoServer) {
      clearTimeout(this.feeTimer)
      return
    }
    try {
      if (Date.now() - this.fees.timestamp > this.feeUpdateInterval) {
        // try earn.com first
        if (!success && earnComFeeInfoServer) {
          const response = await this.io.fetch(earnComFeeInfoServer)
          // try earn.com
          if (!response.ok) {
            throw new Error(
              `${earnComFeeInfoServer} returned status ${response.status}`
            )
          }
          const feesJson: EarnComFees = await response.json()
          if (validateObject(feesJson, EarnComFeesSchema)) {
            const newFees = calcFeesFromEarnCom(feesJson.fees, this.log)
            this.fees = { ...this.fees, ...newFees }
            this.fees.timestamp = Date.now()
          } else {
            this.log.error('Fetched invalid earn.com networkFees')
            throw new Error('Fetched invalid networkFees')
          }
        }

        // if necessary, try mempool.space
        if (!success && mempoolSpaceFeeInfoServer) {
          try {
            const response = await this.io.fetch(mempoolSpaceFeeInfoServer)
            if (response.ok) {
              const feesJson = await response.json()
              asMempoolSpaceResult(feesJson)
              const newFees = calcFeesFromMempoolSpace(feesJson)
              this.fees = { ...this.fees, ...newFees }
              this.fees.timestamp = Date.now()
              success = true
            }
          } catch (e) {
            this.log.error(`mempool.space error ${JSON.stringify(e)}`)
          }
        }
      }
    } catch (e) {
      this.log.error(
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

  getRate({
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
    if (networkFeeOption === 'custom') {
      const customFeeNumber = Number(customFeeAmount)
      if (customFeeNumber < 1 || isNaN(customFeeNumber)) {
        const e = new Error(`1 satPerByte`)
        e.name = 'ErrorBelowMinimumFee'
        throw e
      }
      // customNetworkFee is in sat/Bytes in need to be converted to sat/KB
      return customFeeNumber * BYTES_TO_KB
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

  logEdgeTransaction(edgeTransaction: EdgeTransaction, action: string) {
    let log = `------------------ ${action} Transaction ------------------\n`
    log += `Transaction id: ${edgeTransaction.txid}\n`
    log += `Our Receiving addresses are: ${edgeTransaction.ourReceiveAddresses.toString()}\n`
    log += 'Transaction details:\n'
    if (edgeTransaction.otherParams && edgeTransaction.otherParams.txJson) {
      log += JSON.stringify(edgeTransaction.otherParams.txJson, null, 2) + '\n'
    }
    log += '------------------------------------------------------------------'
    this.log.warn(`${this.prunedWalletId}: ${log}`)
  }

  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------

  async changeUserSettings(userSettings: Object): Promise<mixed> {
    await this.pluginState.updateServers(userSettings)
  }

  async startEngine(): Promise<void> {
    this.callbacks.onBalanceChanged(this.currencyCode, this.getBalance())
    this.updateFeeFromEdge().then(() => this.updateFeeFromVendor())
    return this.engineState.connect()
  }

  async killEngine(): Promise<void> {
    clearTimeout(this.feeTimer)
    return this.engineState.disconnect()
  }

  async resyncBlockchain(): Promise<void> {
    await this.killEngine()
    await this.engineState.clearCache()
    await this.pluginState.clearCache()
    await this.keyManager.reload()
    await this.startEngine()
  }

  getBlockHeight(): number {
    return this.pluginState.height
  }

  async enableTokens(tokens: string[]): Promise<void> {}

  async getEnabledTokens(): Promise<string[]> {
    return []
  }

  async addCustomToken(token: any): Promise<void> {}

  async disableTokens(tokens: string[]): Promise<void> {}

  getTokenStatus(token: string): boolean {
    return false
  }

  getBalance(options: any): string {
    return this.engineState.getBalance()
  }

  getNumTransactions(options: any): number {
    return this.engineState.getNumTransactions(options)
  }

  async getTransactions(
    options: EdgeGetTransactionsOptions
  ): Promise<EdgeTransaction[]> {
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

  getFreshAddress(options: any): EdgeFreshAddress {
    const publicAddress = this.keyManager.getReceiveAddress()
    const legacyAddress = toLegacyFormat(publicAddress, this.network)
    return { publicAddress, legacyAddress }
  }

  addGapLimitAddresses(addresses: string[], options: any): void {
    const scriptHashPromises = addresses.map(address => {
      const scriptHash = this.engineState.scriptHashes[address]
      if (typeof scriptHash === 'string') return Promise.resolve(scriptHash)
      else return addressToScriptHash(address, this.network)
    })
    Promise.all(scriptHashPromises)
      .then((scriptHashs: string[]) => {
        this.engineState.markAddressesUsed(scriptHashs)
        if (this.keyManager) this.keyManager.setLookAhead()
      })
      .catch(e => this.log.error(`${this.prunedWalletId}: ${e.toString()}`))
  }

  isAddressUsed(address: string, options: any): boolean {
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

  async sweepPrivateKeys(
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
      localDisklet: this.walletLocalDisklet,
      encryptedLocalDisklet: this.walletLocalEncryptedDisklet,
      pluginState: this.pluginState,
      walletId: this.prunedWalletId,
      engineInfo: this.engineInfo,
      log: this.log
    })

    await engineState.load()
    const addresses = await getAllAddresses(privateKeys, this.network)
    addresses.forEach(({ address, scriptHash }) =>
      // $FlowFixMe missing path parameter
      engineState.addAddress(scriptHash, address)
    )
    engineState.connect()

    return end
  }

  async getPaymentProtocolInfo(
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
      this.log.error(`${this.prunedWalletId} - ${err.toString()}`)
      throw err
    }
  }

  async makeSpend(
    edgeSpendInfo: EdgeSpendInfo,
    txOptions?: TxOptions = {}
  ): Promise<EdgeTransaction> {
    const { spendTargets } = edgeSpendInfo
    // Can't spend without outputs
    if (!txOptions.CPFP && (!spendTargets || spendTargets.length < 1)) {
      this.log.error('Need to provide Spend Targets')
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
      this.log.error(`InsufficientFundError ${this.currencyCode}`)
      throw new InsufficientFundsError(this.currencyCode)
    }
    try {
      // Get the rate according to the latest fee
      const rate = this.getRate(edgeSpendInfo)
      this.log.warn(`spend: Using fee rate ${rate} sat/K`)

      const minRelay = this.engineInfo.minRelay

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
        minRelay,
        txOptions,
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

      const addresses = getReceiveAddresses(bcoinTx, this.network)

      const ourReceiveAddresses = addresses.filter(
        address => scriptHashes[address]
      )

      const networkFee = bcoinTx.getFee()

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
        nativeAmount: `${sumOfTx - parseInt(networkFee)}`,
        networkFee: `${networkFee}`,
        feeRateUsed: {
          satPerVByte: rate / 1000
        },
        signedTx: ''
      }
      return edgeTransaction
    } catch (e) {
      this.log.error(`makeSpend error ${JSON.stringify(e)}`)
      if (e.type === 'FundingError')
        throw new InsufficientFundsError(this.currencyCode)
      throw e
    }
  }

  async signTx(edgeTransaction: EdgeTransaction): Promise<EdgeTransaction> {
    if (edgeTransaction.otherParams == null) edgeTransaction.otherParams = {}
    const { otherParams } = edgeTransaction
    const { edgeSpendInfo, txJson } = otherParams
    this.logEdgeTransaction(edgeTransaction, 'Signing')
    const bcoinTx = parseJsonTransaction(txJson)
    const { privateKeys = [] } = edgeSpendInfo
    const { signedTx, txid } = await this.keyManager.sign(bcoinTx, privateKeys)

    const { paymentProtocolInfo } = edgeSpendInfo.otherParams || {}
    if (paymentProtocolInfo) {
      const publicAddress = this.getFreshAddress().publicAddress
      const address = toLegacyFormat(publicAddress, this.network)
      const payment = createPayment(
        paymentProtocolInfo,
        address,
        signedTx,
        this.currencyCode
      )
      Object.assign(otherParams, {
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

  async broadcastTx(
    edgeTransaction: EdgeTransaction
  ): Promise<EdgeTransaction> {
    if (edgeTransaction.otherParams == null) edgeTransaction.otherParams = {}
    const { otherParams, signedTx, currencyCode } = edgeTransaction
    const { paymentProtocolInfo } = otherParams

    if (paymentProtocolInfo && paymentProtocolInfo.payment) {
      const paymentAck = await sendPayment(
        this.io.fetch,
        this.network,
        paymentProtocolInfo.paymentUrl,
        paymentProtocolInfo.payment,
        this.log
      )
      if (!paymentAck) {
        throw new Error(
          `Error when sending to ${paymentProtocolInfo.paymentUrl}`
        )
      }
    }

    const tx = verifyTxAmount(signedTx)
    if (!tx) throw new Error('Wrong spend amount')
    otherParams.txJson = tx.getJSON(this.network)
    this.logEdgeTransaction(edgeTransaction, 'Broadcasting')

    // Try APIs
    const promiseArray = []
    if (!this.pluginState.disableFetchingServers) {
      for (const broadcastFactory of broadcastFactories) {
        const broadcaster = broadcastFactory(this.io, currencyCode, this.log)
        if (broadcaster) promiseArray.push(broadcaster(signedTx))
      }
    }

    promiseArray.push(this.engineState.broadcastTx(signedTx))
    await promiseAny(promiseArray)
    return edgeTransaction
  }

  saveTx(edgeTransaction: EdgeTransaction): Promise<void> {
    this.logEdgeTransaction(edgeTransaction, 'Saving')
    this.engineState.saveTx(edgeTransaction.txid, edgeTransaction.signedTx)
    return Promise.resolve()
  }

  getDisplayPrivateSeed(): string | null {
    return this.keyManager ? this.keyManager.getSeed() : null
  }

  getDisplayPublicSeed(): string | null {
    return this.keyManager ? this.keyManager.getPublicSeed() : null
  }

  dumpData(): EdgeDataDump {
    return {
      walletId: this.walletId.split(' - ')[0],
      walletType: this.walletInfo.type,
      walletFormat: this.walletInfo.keys && this.walletInfo.keys.format,
      pluginType: this.pluginState.pluginId,
      fees: this.fees,
      data: {
        ...this.pluginState.dumpData(),
        ...this.engineState.dumpData()
      }
    }
  }
}
