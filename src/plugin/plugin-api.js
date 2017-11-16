// @flow
import type {
  AbcCorePluginOptions,
  AbcCurrencyEngine,
  AbcCurrencyInfo,
  AbcCurrencyPlugin,
  AbcEncodeUri,
  AbcIo,
  AbcCurrencyEngineOptions,
  AbcParsedUri,
  AbcWalletInfo
} from 'airbitz-core-types'

import { PluginState } from './plugin-state.js'
import { CurrencyEngine } from '../engine/engine-api.js'

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyPlugin {
  currencyInfo: AbcCurrencyInfo
  pluginName: string

  createPrivateKey (walletType: string): {} {
    return {} // TODO: Implement this
  }

  derivePublicKey (walletInfo: AbcWalletInfo): {} {
    return {} // TODO: Implement this
  }

  makeEngine (
    walletInfo: AbcWalletInfo,
    options: AbcCurrencyEngineOptions
  ): Promise<AbcCurrencyEngine> {
    return Promise.resolve(
      new CurrencyEngine(walletInfo, options, this.state, this.io)
    )
  }

  parseUri (uri: string): AbcParsedUri {
    return {} // TODO: Implement this
  }

  encodeUri (obj: AbcEncodeUri): string {
    return ({}: any) // TODO: Implement this
  }

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------
  constructor (options: AbcCorePluginOptions, currencyInfo: AbcCurrencyInfo) {
    // Validate that we are a valid AbcCurrencyPlugin:
    // eslint-disable-next-line no-unused-vars
    const test: AbcCurrencyPlugin = this

    // Public API:
    this.currencyInfo = currencyInfo
    this.pluginName = currencyInfo.currencyName.toLowerCase()

    // Private stuff:
    this.io = options.io
    this.state = new PluginState()
  }

  io: AbcIo
  state: PluginState
}
