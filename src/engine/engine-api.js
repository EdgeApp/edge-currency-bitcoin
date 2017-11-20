// @flow
import type {
  AbcCurrencyEngine,
  AbcCurrencyEngineOptions,
  AbcFreshAddress,
  AbcSpendInfo,
  AbcTransaction
} from 'airbitz-core-types'

import { EngineState } from './engine-state.js'
import { PluginState } from '../plugin/plugin-state.js'
import { KeyManager } from './keyManager'

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyEngine {
  keyManager: KeyManager
  options: AbcCurrencyEngineOptions
  engineState: EngineState
  pluginState: PluginState

  // ------------------------------------------------------------------------
  // Private API
  // ------------------------------------------------------------------------
  constructor (
    keyManager: KeyManager,
    options: AbcCurrencyEngineOptions,
    pluginState: PluginState,
    engineState: EngineState
  ) {
    // Validate that we are a valid AbcCurrencyEngine:
    // eslint-disable-next-line no-unused-vars
    const test: AbcCurrencyEngine = this

    this.engineState = engineState
    this.pluginState = pluginState
    this.keyManager = keyManager
    this.options = options
  }

  static async makeEngine (
    keyManager: KeyManager,
    options: AbcCurrencyEngineOptions,
    pluginState: PluginState,
    engineState: EngineState
  ): Promise<AbcCurrencyEngine> {
    const engine = new CurrencyEngine(keyManager, options, pluginState, engineState)
    return engine
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
}
