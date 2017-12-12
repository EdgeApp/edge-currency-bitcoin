// @flow
import type {
  AbcWalletInfo,
  AbcCurrencyEngine,
  AbcCurrencyEngineOptions,
  AbcFreshAddress,
  AbcSpendInfo,
  AbcTransaction,
  AbcCurrencyInfo,
  AbcSpendTarget
} from 'airbitz-core-types'

import { EngineState } from './engine-state.js'
import { PluginState } from '../plugin/plugin-state.js'
import { KeyManager } from './keyManager'
import type { EngineStateCallbacks } from './engine-state.js'
import type { KeyManagerCallbacks } from './keyManager'
import type { EarnComFees, BitcoinFees } from '../utils/flowTypes.js'
import { calcFeesFromEarnCom, calcMinerFeePerByte } from './miningFees.js'
import bcoin from 'bcoin'

const BYTES_TO_KB = 1000
const MILI_TO_SEC = 1000

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyEngine {
  walletInfo: AbcWalletInfo
  currencyInfo: AbcCurrencyInfo
  keyManager: KeyManager
  engineState: EngineState
  pluginState: PluginState
  options: AbcCurrencyEngineOptions
  network: string
  rawTransactionFees: {
    lastUpdated: number,
    fees: Array<any>
  }
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
    this.currencyInfo = currencyInfo
    this.pluginState = pluginState
    this.options = options
    this.network = this.currencyInfo.defaultSettings.network.type
    this.feeInfoServer = this.currencyInfo.defaultSettings.feeInfoServer
    this.feeUpdateInterval = this.currencyInfo.defaultSettings.feeUpdateInterval
    this.fees = {
      highFee: '',
      lowFee: '',
      standardFeeLow: '',
      standardFeeHigh: '',
      standardFeeLowAmount: '',
      standardFeeHighAmount: ''
    }
    if (this.currencyInfo.defaultSettings.simpleFeeSettings) {
      Object.assign(
        this.fees,
        this.currencyInfo.defaultSettings.simpleFeeSettings
      )
    }
    this.rawTransactionFees = {
      lastUpdated: 0,
      fees: []
    }
  }

  async load (): Promise<any> {
    const engineStateCallbacks: EngineStateCallbacks = {
      onUtxosUpdated: (addressHash: string) => {
        this.keyManager.use(addressHash)
        this.options.callbacks.onBalanceChanged(
          this.currencyInfo.currencyCode,
          this.getBalance()
        )
      },
      // onTxidsUpdated: (addressHash: string) => {
      //   this.options.callbacks.onTxidsChanged(height)
      // },
      onHeightUpdated: (height: number) => {
        this.options.callbacks.onBlockHeightChanged(height)
      },
      onTxFetched: (txid: string) => {
        const abcTransaction = this.getTransaction(txid)
        this.options.callbacks.onTransactionsChanged([abcTransaction])
      }
    }
    const gapLimit = this.currencyInfo.defaultSettings.gapLimit
    const io = this.options.optionalSettings
      ? this.options.optionalSettings.io
      : null

    this.engineState = new EngineState({
      callbacks: engineStateCallbacks,
      bcoin: bcoin,
      io: io,
      localFolder: this.options.walletLocalFolder,
      encryptedLocalFolder: this.options.walletLocalEncryptedFolder,
      pluginState: this.pluginState
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
    if (this.walletInfo.keys && this.walletInfo.keys[`${this.network}Key`]) {
      seed = this.walletInfo.keys[`${this.network}Key`]
    }
    const bip = this.walletInfo.type.split('-')[1]

    this.keyManager = new KeyManager({
      seed: seed,
      rawKeys: rawKeys,
      bip: bip,
      gapLimit: gapLimit,
      network: this.network,
      callbacks: keyManagerCallbacks,
      addressCache: this.engineState.addressCache
    })

    await this.keyManager.load()
  }

  getTransaction (txid: string): AbcTransaction {
    if (!this.engineState.txCache[txid]) {
      throw new Error('Transaction not found')
    }
    const bcoinTransaction = bcoin.primitives.TX.fromRaw(
      this.engineState.txCache[txid],
      'hex'
    )
    const bcoinJSON = bcoinTransaction.getJSON(this.network)
    const ourReceiveAddresses = []
    let nativeAmount = 0
    let totalOutputAmount = 0
    let totalInputAmount = 0

    // Process tx outputs
    const outputsLength = bcoinJSON.outputs.length
    for (let i = 0; i < outputsLength; i++) {
      const { address, value } = bcoinJSON.outputs[i]
      totalOutputAmount += value
      if (this.keyManager.displayAddressMap[address]) {
        nativeAmount += value
        ourReceiveAddresses.push(address)
      }
    }

    // Process tx inputs
    const inputsLength = bcoinJSON.inputs.length
    for (let i = 0; i < inputsLength; i++) {
      const input = bcoinJSON.inputs[i]
      if (input.prevout) {
        const { hash, index } = input.prevout
        const rawTX = this.engineState.txCache[hash]
        if (rawTX) {
          const prevoutBcoinTX = bcoin.primitives.TX.fromRaw(rawTX, 'hex')
          const { value, address } = prevoutBcoinTX.getJSON(
            this.network
          ).outputs[index]
          totalInputAmount += value
          if (this.keyManager.displayAddressMap[address]) {
            nativeAmount -= value
          }
        }
      }
    }

    const { height = -1, firstSeen = Date.now() } =
      this.engineState.txHeightCache[txid] || {}
    let date = firstSeen
    if (height && height !== -1) {
      const blockHeight = this.pluginState.headerCache[height.toString()]
      if (blockHeight) {
        date = blockHeight.timestamp
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
      nativeAmount: nativeAmount.toString(),
      networkFee: fee.toString(),
      signedTx: this.engineState.txCache[txid]
    }
    return abcTransaction
  }

  async updateFeeTable () {
    if (
      this.options.optionalSettings &&
      this.options.optionalSettings.io &&
      this.feeInfoServer !== '' &&
      this.rawTransactionFees.lastUpdated < Date.now() - this.feeUpdateInterval
    ) {
      try {
        const results = await this.options.optionalSettings.io.fetch(
          this.feeInfoServer
        )
        if (results.status !== 200) {
          throw new Error(results.body)
        }
        const { fees }: EarnComFees = await results.json()
        this.rawTransactionFees.lastUpdated = Date.now()
        this.rawTransactionFees.fees = fees
        this.fees = calcFeesFromEarnCom(this.fees, { fees })
      } catch (e) {
        console.log('Error while trying to update fee table', e)
      } finally {
        this.feeTimer = setTimeout(() => {
          this.updateFeeTable()
        }, this.feeUpdateInterval)
      }
    }
  }

  getRate ({
    spendTargets,
    networkFeeOption = 'standard',
    customNetworkFee = ''
  }: AbcSpendInfo): number {
    if (networkFeeOption === 'custom' && customNetworkFee !== '') {
      // customNetworkFee is in sat/Bytes in need to be converted to sat/KB
      return parseInt(customNetworkFee) * BYTES_TO_KB
    } else {
      const amountForTx = spendTargets
        .reduce((s, { nativeAmount }) => s + parseInt(nativeAmount), 0)
        .toString()
      const rate = calcMinerFeePerByte(
        amountForTx,
        networkFeeOption,
        customNetworkFee,
        this.fees
      )
      return parseInt(rate) * BYTES_TO_KB
    }
  }

  getUTXOs () {
    const utxos: any = []
    for (const scriptHash in this.engineState.addressCache) {
      const utxoLength = this.engineState.addressCache[scriptHash].utxos.length
      for (let i = 0; i < utxoLength; i++) {
        const utxo = this.engineState.addressCache[scriptHash].utxos[i]
        const rawTx = this.engineState.txCache[utxo.txid]
        let height = -1
        if (this.engineState.txHeightCache[utxo.txid]) {
          height = this.engineState.txHeightCache[utxo.txid].height
        }
        if (rawTx) {
          utxos.push({ utxo, rawTx, height })
        }
      }
    }
    return utxos
  }

  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------
  updateSettings (settings: any): void {
    // TODO: Implement this
  }

  async startEngine (): Promise<void> {
    const cachedTXs = await this.getTransactions()
    this.options.callbacks.onTransactionsChanged(cachedTXs)
    this.options.callbacks.onBalanceChanged(
      this.currencyInfo.currencyCode,
      this.getBalance()
    )
    await this.updateFeeTable()
    return this.engineState.connect()
  }

  async killEngine (): Promise<void> {
    clearTimeout(this.feeTimer)
    return this.engineState.disconnect()
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
    let balance = 0
    for (const scriptHash in this.engineState.addressCache) {
      const { utxos } = this.engineState.addressCache[scriptHash]
      const utxoLength = utxos.length
      for (let i = 0; i < utxoLength; i++) {
        balance += utxos[i].value
      }
    }
    return balance.toString()
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
    const abcAddress = { publicAddress: this.keyManager.getReceiveAddress() }
    return abcAddress
  }

  addGapLimitAddresses (addresses: Array<string>, options: any): void {
    // TODO: Implement this
  }

  isAddressUsed (address: string, options: any): boolean {
    try {
      bcoin.primitives.Address.fromBase58(address)
    } catch (e) {
      try {
        bcoin.primitives.Address.fromBech32(address)
      } catch (e) {
        throw new Error('Wrong formatted address')
      }
    }
    for (const scriptHash in this.engineState.addressCache) {
      if (
        this.engineState.addressCache[scriptHash].displayAddress === address
      ) {
        return this.engineState.addressCache[scriptHash].used
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
    let resultedTransaction

    try {
      Object.assign(options, {
        rate: this.getRate(abcSpendInfo),
        maxFee: this.currencyInfo.defaultSettings.maxFee,
        outputs: abcSpendInfo.spendTargets,
        utxos: this.getUTXOs(),
        height: this.getBlockHeight()
      })
      resultedTransaction = await this.keyManager.createTX(options)
    } catch (e) {
      if (e.type === 'FundingError') throw new Error('InsufficientFundsError')
      throw e
    }
    const sumOfTx = abcSpendInfo.spendTargets.reduce(
      (s, spendTarget: AbcSpendTarget) => {
        if (
          spendTarget.publicAddress &&
          this.keyManager.displayAddressMap[spendTarget.publicAddress]
        ) {
          return s
        } else return s - parseInt(spendTarget.nativeAmount)
      },
      0
    )

    const ourReceiveAddresses = []
    for (const i in resultedTransaction.outputs) {
      const address = resultedTransaction.outputs[i]
        .getAddress()
        .toString(this.network)
      if (
        address &&
        this.keyManager.displayAddressMap[address]) {
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
      nativeAmount: (
        sumOfTx - parseInt(resultedTransaction.getFee())
      ).toString(),
      networkFee: resultedTransaction.getFee().toString(),
      signedTx: ''
    }
    return abcTransaction
  }

  async signTx (abcTransaction: AbcTransaction): Promise<AbcTransaction> {
    await this.keyManager.sign(abcTransaction.otherParams.bcoinTx)
    abcTransaction.date = Date.now() / MILI_TO_SEC
    abcTransaction.signedTx = abcTransaction.otherParams.bcoinTx
      .toRaw()
      .toString('hex')
    return abcTransaction
  }

  async broadcastTx (abcTransaction: AbcTransaction): Promise<AbcTransaction> {
    try {
      const txid = await this.engineState.broadcastTx(abcTransaction.signedTx)
      abcTransaction.txid = txid
      return abcTransaction
    } catch (e) {
      console.log('error broadcasting tx', e)
      return abcTransaction
    }
  }

  saveTx (abcTransaction: AbcTransaction): Promise<void> {
    return Promise.resolve() // TODO: Implement this
  }
}
