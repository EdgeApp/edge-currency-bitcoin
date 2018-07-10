// @flow
import type {
  EdgeTransaction,
  EdgeWalletInfo,
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyEngineCallbacks,
  EdgePaymentProtocolInfo,
  EdgeFreshAddress,
  EdgeSpendInfo,
  EdgeCurrencyInfo,
  EdgeSpendTarget,
  EdgeDataDump,
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
import { parsePayment } from './paymentRequest.js'
import { InfoServerFeesSchema } from '../utils/jsonSchemas.js'
import { calcFeesFromEarnCom, calcMinerFeePerByte } from './miningFees.js'
import { broadcastFactories } from './broadcastApi.js'
import { bns } from 'biggystring'
import { getAllAddresses } from '../utils/formatSelector.js'
import {
  addressToScriptHash,
  keysFromWalletInfo,
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
/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyEngine {
  walletInfo: EdgeWalletInfo
  walletId: string
  currencyInfo: EdgeCurrencyInfo
  keyManager: KeyManager
  engineState: EngineState
  pluginState: PluginState
  edgeCurrencyEngineOptions: EdgeCurrencyEngineOptions
  callbacks: EdgeCurrencyEngineCallbacks
  walletLocalFolder: DiskletFolder
  walletLocalEncryptedFolder: DiskletFolder
  io: any
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
    walletInfo: EdgeWalletInfo,
    currencyInfo: EdgeCurrencyInfo,
    pluginState: PluginState,
    options: EdgeCurrencyEngineOptions
  ) {
    // Validate that we are a valid EdgeCurrencyEngine:
    // eslint-disable-next-line no-unused-vars
    const test: EdgeCurrencyEngine = this

    this.walletInfo = walletInfo
    this.walletId = walletInfo.id || ''
    this.currencyInfo = currencyInfo
    this.pluginState = pluginState
    this.edgeCurrencyEngineOptions = options
    this.callbacks = this.edgeCurrencyEngineOptions.callbacks
    this.walletLocalFolder = this.edgeCurrencyEngineOptions.walletLocalFolder
    this.walletLocalEncryptedFolder = this.edgeCurrencyEngineOptions.walletLocalEncryptedFolder
    this.io = null
    if (this.edgeCurrencyEngineOptions.optionalSettings) {
      this.io = this.edgeCurrencyEngineOptions.optionalSettings.io
    }
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
      onHeightUpdated: this.callbacks.onBlockHeightChanged,
      onTxFetched: (txid: string) => {
        const edgeTransaction = this.getTransaction(txid)
        this.callbacks.onTransactionsChanged([edgeTransaction])
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
    const { seed, bip, coinType, rawKeys } = keysFromWalletInfo(
      this.network,
      this.walletInfo,
      cachedRawKeys
    )

    this.keyManager = new KeyManager({
      seed: seed,
      bip: bip,
      coinType: coinType,
      rawKeys: rawKeys,
      callbacks: callbacks,
      gapLimit: this.currencyInfo.defaultSettings.gapLimit,
      network: this.network,
      addressInfos: this.engineState.addressInfos,
      txInfos: this.engineState.parsedTxs
    })

    this.engineState.onAddressUsed = () => {
      this.keyManager.setLookAhead()
    }

    this.engineState.onBalanceChanged = () => {
      this.callbacks.onBalanceChanged(
        this.currencyInfo.currencyCode,
        this.getBalance()
      )
    }

    await this.keyManager.load()
  }

  getTransaction (txid: string): EdgeTransaction {
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
      currencyCode: this.currencyInfo.currencyCode,
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
      if (!this.io || !this.io.fetch) {
        throw new Error('No io/fetch object')
      }
      await this.fetchFee()
      if (!this.infoServer) {
        throw new Error('infoServer not set')
      }
      if (Date.now() - this.fees.timestamp > this.feeUpdateInterval) {
        const url = `${this.infoServer}/networkFees/${
          this.currencyInfo.currencyCode
        }`
        const feesResponse = await this.io.fetch(url)
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
        if (!this.io || !this.io.fetch) {
          throw new Error('No io/fetch object')
        }
        const results = await this.io.fetch(this.feeInfoServer)
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
  }: EdgeSpendInfo): number {
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
  updateSettings (settings: any): void {
    // TODO: Implement this
  }

  async startEngine (): Promise<void> {
    const cachedTXs = await this.getTransactions()
    this.callbacks.onTransactionsChanged(cachedTXs)
    this.callbacks.onBalanceChanged(
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
    return this.engineState.getBalance()
  }

  getNumTransactions (options: any): number {
    return this.engineState.getNumTransactions(options)
  }

  async getTransactions (options: any): Promise<Array<EdgeTransaction>> {
    const rawTxs = this.engineState.txCache
    const edgeTransactions = []
    for (const txid in rawTxs) {
      const edgeTransaction = this.getTransaction(txid)
      edgeTransactions.push(edgeTransaction)
    }

    const startIndex = (options && options.startIndex) || 0
    let endIndex =
      (options && options.numEntries + startIndex) || edgeTransactions.length
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
      else return addressToScriptHash(address)
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
    // $FlowFixMe
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
      if (!this.io || !this.io.fetch) {
        throw new Error('No io/fetch object')
      }

      const headers = { 'Accept': 'application/bitcoin-paymentrequest' }
      // Legacy fetching using XMLHttpRequest
      // This is for enviroments that don't support 'arrayBuffer'
      // like some versions of react-native and old browsers
      const legacyFetch = async (url) => {
        return new Promise((resolve, reject) => {
          const req = new window.XMLHttpRequest()
          req.open('GET', url, true)
          for (const header in headers) {
            req.setRequestHeader(header, headers[header])
          }
          req.responseType = 'arraybuffer'
          req.onload = (event) => {
            const resp = req.response
            if (resp) {
              resolve(resp)
            }
          }
          req.send(null)
        })
      }
      let result
      // Use the modern API if in node or any enviroment which supports it
      if (typeof window === 'undefined' ||
        (window.Response && window.Response.prototype.arrayBuffer)
      ) {
        result = await this.io.fetch(paymentProtocolURL, { headers })
        result = await result.arrayBuffer()
      } else if (window && window.XMLHttpRequest) {
        result = await legacyFetch(paymentProtocolURL)
      }

      // $FlowFixMe
      const buf = Buffer.from(result)
      return parsePayment(buf, this.network, this.currencyInfo.currencyCode)
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
      (sum, { nativeAmount }) => bns.add(sum, nativeAmount || '0'), '0')
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
        .filter(({ publicAddress, nativeAmount }) =>
          publicAddress && nativeAmount)
        .map(({ publicAddress = '', nativeAmount = 0 }) => ({
          address: typeof publicAddress !== 'string'
            ? toLegacyFormat(publicAddress.toString(), this.network)
            : toLegacyFormat(publicAddress, this.network),
          value: parseInt(nativeAmount)
        }))

      const bcoinTx = await this.keyManager.createTX({
        outputs,
        utxos,
        rate,
        txOptions,
        maxFee: this.currencyInfo.defaultSettings.maxFee,
        height: this.getBlockHeight()
      })

      const { scriptHashes } = this.engineState
      const sumOfTx = spendTargets.reduce((s, {
        publicAddress,
        nativeAmount
      }: EdgeSpendTarget) => (publicAddress && scriptHashes[publicAddress])
        ? s : s - parseInt(nativeAmount), 0)

      const ourReceiveAddresses = []
      for (const i in bcoinTx.outputs) {
        let address = bcoinTx.outputs[i]
          .getAddress()
          .toString(this.network)
        address = toNewFormat(address, this.network)
        if (address && scriptHashes[address]) {
          ourReceiveAddresses.push(address)
        }
      }

      const edgeTransaction: EdgeTransaction = {
        ourReceiveAddresses,
        otherParams: { bcoinTx, edgeSpendInfo, rate },
        currencyCode: this.currencyInfo.currencyCode,
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
    const { privateKeys = [] } = edgeSpendInfo
    const { signedTx, txid } = await this.keyManager.sign(bcoinTx, privateKeys)
    return { ...edgeTransaction, signedTx, txid, date: Date.now() / MILLI_TO_SEC }
  }

  async broadcastTx (
    edgeTransaction: EdgeTransaction
  ): Promise<EdgeTransaction> {
    const { otherParams = {}, signedTx, currencyCode } = edgeTransaction
    const tx = verifyTxAmount(signedTx, otherParams.bcoinTx)
    if (!tx) throw new Error('Wrong spend amount')
    edgeTransaction.otherParams.bcoinTx = tx
    this.logEdgeTransaction(edgeTransaction, 'Broadcasting')

    // Try APIs
    const promiseArray = []
    if (this.io && this.io.fetch) {
      for (const broadcastFactory of broadcastFactories) {
        const broadcaster = broadcastFactory(this.io, currencyCode)
        if (broadcaster) promiseArray.push(broadcaster(signedTx))
      }
    }
    promiseArray.push(this.engineState.broadcastTx(signedTx))

    try {
      await promiseAny(promiseArray)
    } catch (e) {
      throw e
    }

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
      pluginType: this.currencyInfo.pluginName,
      fees: this.fees,
      data: {
        ...this.pluginState.dumpData(),
        ...this.engineState.dumpData()
      }
    }
  }
}
