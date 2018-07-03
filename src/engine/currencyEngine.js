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
import { validateObject, promiseAny } from '../utils/utils.js'
import { parsePayment } from '../utils/paymentRequest.js'
import { InfoServerFeesSchema } from '../utils/jsonSchemas.js'
import { calcFeesFromEarnCom, calcMinerFeePerByte } from './miningFees.js'
import { bns } from 'biggystring'
import { broadcastFactories } from './broadcastApi.js'
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
    const gapLimit = this.currencyInfo.defaultSettings.gapLimit

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
    const jsonObj = edgeTransaction.otherParams.bcoinTx.getJSON(this.network)
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

    await this.engineState.load()

    for (const key of privateKeys) {
      const privKey = bcoin.primitives.KeyRing.fromSecret(key, this.network)
      const keyAddress = privKey.getAddress('base58')
      privKey.nested = true
      privKey.witness = true
      const nestedAddress = privKey.getAddress('base58')
      const keyHash = await this.keyManager.addressToScriptHash(keyAddress)
      const nestedHash = await this.keyManager.addressToScriptHash(
        nestedAddress
      )
      engineState.addAddress(keyHash, keyAddress)
      engineState.addAddress(nestedHash, nestedAddress)
    }

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
    options?: any = {}
  ): Promise<EdgeTransaction> {
    // Can't spend without outputs
    if (
      !options.CPFP &&
      (!edgeSpendInfo.spendTargets || edgeSpendInfo.spendTargets.length < 1)
    ) {
      throw new Error('Need to provide Spend Targets')
    }
    const totalAmountToSend = edgeSpendInfo.spendTargets.reduce(
      (sum, { nativeAmount }) => bns.add(sum, nativeAmount || '0'),
      '0'
    )

    const balance = options.utxos
      ? options.utxos.reduce((sum, { utxo }) => sum + utxo.value, 0)
      : this.getBalance()

    if (bns.gt(totalAmountToSend, `${balance}`)) {
      throw new Error('InsufficientFundsError')
    }
    try {
      // If somehow we have outdated fees, try and get new ones
      if (Date.now() - this.fees.timestamp > this.feeUpdateInterval) {
        await this.updateFeeTable()
      }
      Object.assign(options, {
        rate: this.getRate(edgeSpendInfo),
        maxFee: this.currencyInfo.defaultSettings.maxFee,
        outputs: edgeSpendInfo.spendTargets,
        utxos: options.utxos || this.engineState.getUTXOs(),
        height: this.getBlockHeight()
      })
      const resultedTransaction = await this.keyManager.createTX(options)
      const sumOfTx = edgeSpendInfo.spendTargets.reduce(
        (s, spendTarget: EdgeSpendTarget) => {
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

      const edgeTransaction: EdgeTransaction = {
        ourReceiveAddresses,
        otherParams: {
          bcoinTx: resultedTransaction,
          edgeSpendInfo,
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
      return edgeTransaction
    } catch (e) {
      if (e.type === 'FundingError') throw new Error('InsufficientFundsError')
      throw e
    }
  }

  async signTx (edgeTransaction: EdgeTransaction): Promise<EdgeTransaction> {
    this.logEdgeTransaction(edgeTransaction, 'Signing')
    const otherParams = edgeTransaction.otherParams
    const { edgeSpendInfo, bcoinTx } = otherParams
    const { privateKeys = [] } = edgeSpendInfo
    await this.keyManager.sign(bcoinTx, privateKeys)
    edgeTransaction.date = Date.now() / MILLI_TO_SEC
    edgeTransaction.signedTx = bcoinTx.toRaw().toString('hex')
    edgeTransaction.txid = bcoinTx.rhash()
    return edgeTransaction
  }

  async broadcastTx (
    edgeTransaction: EdgeTransaction
  ): Promise<EdgeTransaction> {
    if (!edgeTransaction.otherParams.bcoinTx) {
      edgeTransaction.otherParams.bcoinTx = bcoin.primitives.TX.fromRaw(
        edgeTransaction.signedTx,
        'hex'
      )
    }
    this.logEdgeTransaction(edgeTransaction, 'Broadcasting')
    for (const output of edgeTransaction.otherParams.bcoinTx.outputs) {
      if (output.value <= 0 || output.value === '0') {
        throw new Error('Wrong spend amount')
      }
    }

    // Try APIs
    const broadcasters = []
    if (this.io) {
      for (const f of broadcastFactories) {
        const broadcaster = f(this.io, edgeTransaction.currencyCode)
        if (broadcaster) broadcasters.push(broadcaster)
      }
    }

    const promiseArray = []

    for (const broadcaster of broadcasters) {
      const p = broadcaster(edgeTransaction.signedTx)
      promiseArray.push(p)
    }
    promiseArray.push(this.engineState.broadcastTx(edgeTransaction.signedTx))

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
    const dataDump: EdgeDataDump = {
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
