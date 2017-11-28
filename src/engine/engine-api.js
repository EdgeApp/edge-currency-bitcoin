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
  }

  async load (): Promise<any> {
    const callbacks: EngineStateCallbacks = {
      onUtxosUpdated: (addressHash: string) => {
        this.options.callbacks.onBalanceChanged(this.currencyInfo.currencyCode, this.getBalance())
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
    let io = null
    if (this.options.optionalSettings) {
      io = this.options.optionalSettings.io
    }

    this.engineState = new EngineState({
      callbacks,
      bcoin,
      io,
      localFolder: this.options.walletLocalFolder,
      pluginState: this.pluginState
    })

    await this.engineState.load()

    this.keyManager = new KeyManager(
      this.walletInfo,
      this.engineState,
      gapLimit,
      this.network
    )

    await this.keyManager.load()
  }

  getAllAddresses () {
    const allOurAddresses = []
    for (const scriptHash in this.engineState.addressCache) {
      allOurAddresses.push(
        this.engineState.addressCache[scriptHash].displayAddress
      )
    }
    return allOurAddresses
  }

  getTransaction (txid: string): AbcTransaction {
    if (!this.engineState.txCache[txid]) throw new Error('Transaction not found')
    const bcoinTransaction = bcoin.primitives.TX.fromRaw(this.engineState.txCache[txid], 'hex')
    const bcoinJSON = bcoinTransaction.getJSON(this.network)
    const allOurAddresses = this.getAllAddresses()
    const ourReceiveAddresses = []
    let nativeAmount = 0
    let totalOutputAmount = 0
    let totalInputAmount = 0

    // Process tx outputs
    bcoinJSON.outputs.forEach(({ address, value }) => {
      totalOutputAmount += value
      if (allOurAddresses.indexOf(address) !== -1) {
        nativeAmount += value
        ourReceiveAddresses.push(address)
      }
    })

    // Process tx inputs
    bcoinJSON.inputs.forEach(input => {
      if (input.prevout) {
        const { hash, index } = input.prevout
        const rawTX = this.engineState.txCache[hash]
        if (rawTX) {
          const prevoutBcoinTX = bcoin.primitives.TX.fromRaw(rawTX, 'hex')
          const { value, address } = prevoutBcoinTX.getJSON(this.network).outputs[index]
          totalInputAmount += value
          if (allOurAddresses.indexOf(address) !== -1) {
            nativeAmount -= value
          }
        }
      }
    })

    const { height, firstSeen } = this.engineState.txHeightCache[txid]
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

  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------
  updateSettings (settings: any): void {
    // TODO: Implement this
  }

  startEngine (): Promise<void> {
    this.engineState.connect()
    return Promise.resolve()
  }

  killEngine (): Promise<void> {
    this.engineState.disconnect()
    return Promise.resolve()
  }

  getBlockHeight (): number {
    return this.pluginState.height
  }

  enableTokens (tokens: Array<string>): Promise<void> {
    return Promise.reject(new Error('This plugin has no tokens'))
  }

  getEnabledTokens (): Promise<Array<string>> {
    return Promise.resolve([])
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
      balance += utxos.reduce((s, { value }) => s + value, 0)
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
    let endIndex = (options && options.numEntries) || abcTransactions.length
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
    for (const scriptHash in this.engineState.addressCache) {
      if (
        this.engineState.addressCache[scriptHash].displayAddress === address
      ) {
        return this.engineState.addressCache[scriptHash].used
      }
    }
    return false
  }

  async makeSpend (abcSpendInfo: AbcSpendInfo): Promise<AbcTransaction> {
    // Can't spend without outputs
    if (!abcSpendInfo.spendTargets || abcSpendInfo.spendTargets.length < 1) {
      throw new Error('Need to provide Spend Targets')
    }

    const feeOption = abcSpendInfo.networkFeeOption || 'standard'
    let rate, resultedTransaction

    if (feeOption === 'custom') {
      // customNetworkFee is in sat/Bytes in need to be converted to sat/KB
      rate = parseInt(abcSpendInfo.customNetworkFee) * BYTES_TO_KB
    } else {
      // defualt fees are in sat/KB
      rate = 100 // Needs to get real rate from rate calculator
    }

    try {
      const height = this.getBlockHeight()
      const utxos = [] // Get real UTXO
      const { spendTargets } = abcSpendInfo
      resultedTransaction = await this.keyManager.createTX(
        spendTargets,
        utxos,
        height,
        rate,
        this.txLibInfo.defaultSettings.maxFee
      )
    } catch (e) {
      if (e.type === 'FundingError') throw new Error('InsufficientFundsError')
      throw e
    }
    const allOurAddresses = this.getAllAddresses()
    const sumOfTx = abcSpendInfo.spendTargets.reduce(
      (s, spendTarget: AbcSpendTarget) => {
        if (
          spendTarget.publicAddress &&
          allOurAddresses.indexOf(spendTarget.publicAddress) !== -1
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
      if (address && allOurAddresses.indexOf(address) !== -1) {
        ourReceiveAddresses.push(address)
      }
    }

    const abcTransaction: AbcTransaction = {
      ourReceiveAddresses,
      otherParams: {
        bcoinTx: resultedTransaction,
        abcSpendInfo,
        rate
      },
      currencyCode: this.txLibInfo.currencyCode,
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

  broadcastTx (abcTransaction: AbcTransaction): Promise<AbcTransaction> {
    return Promise.resolve(abcTransaction) // TODO: Implement this
  }

  saveTx (abcTransaction: AbcTransaction): Promise<void> {
    return Promise.resolve() // TODO: Implement this
  }
}
