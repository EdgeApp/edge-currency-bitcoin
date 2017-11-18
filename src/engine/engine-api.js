// @flow
import type {
  AbcCurrencyEngine,
  AbcCurrencyEngineOptions,
  AbcFreshAddress,
  AbcSpendInfo,
  AbcTransaction,
  AbcWalletInfo
} from 'airbitz-core-types'

import { EngineState } from './engine-state.js'
import { PluginState } from '../plugin/plugin-state.js'

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyEngine {
  updateSettings (settings: any): void {
    // TODO: Implement this
  }

  startEngine (): Promise<void> {
    this.state.connect()
    return Promise.resolve()
  }

  killEngine (): Promise<void> {
    this.state.disconnect()
    return Promise.resolve()
  }

  getBlockHeight (): number {
    return this.plugin.headerCache.height
  }

  enableTokens (tokens: Array<string>): Promise<void> {
    return Promise.reject(new Error('This plugin has no tokens'))
  }

  getTokenStatus (token: string): boolean {
    return false
  }

  getBalance (options: any): string {
    return (0).toFixed(0) // TODO: Implement this
  }

  getNumTransactions (options: any): number {
    return 0 // TODO: Implement this
  }

  getTransactions (options: any): Promise<Array<AbcTransaction>> {
    return Promise.resolve([]) // TODO: Implement this
  }

  getFreshAddress (options: any): AbcFreshAddress {
    return ({}: any) // TODO: Implement this
  }

  addGapLimitAddresses (addresses: Array<string>, options: any): void {
    // TODO: Implement this
  }

  isAddressUsed (address: string, options: any): boolean {
    return false // TODO: Implement this
  }

  makeSpend (abcSpendInfo: AbcSpendInfo): Promise<AbcTransaction> {
    const transaction: AbcTransaction = ({}: any)
    return Promise.resolve(transaction) // TODO: Implement this
  }

  signTx (abcTransaction: AbcTransaction): Promise<AbcTransaction> {
    return Promise.resolve(abcTransaction) // TODO: Implement this
  }

  broadcastTx (abcTransaction: AbcTransaction): Promise<AbcTransaction> {
    return Promise.resolve(abcTransaction) // TODO: Implement this
  }

  saveTx (abcTransaction: AbcTransaction): Promise<void> {
    return Promise.resolve() // TODO: Implement this
  }

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------
  constructor (
    walletInfo: AbcWalletInfo,
    options: AbcCurrencyEngineOptions,
    pluginState: PluginState,
    engineState: EngineState
  ) {
    // Validate that we are a valid AbcCurrencyEngine:
    // eslint-disable-next-line no-unused-vars
    const test: AbcCurrencyEngine = this

    this.state = engineState
    this.plugin = pluginState
  }

  state: EngineState
  plugin: PluginState
}
