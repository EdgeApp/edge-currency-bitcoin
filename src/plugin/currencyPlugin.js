// @flow
import type {
  EdgeCorePluginOptions,
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyInfo,
  EdgeCurrencyPlugin,
  EdgeIo,
  EdgeWalletInfo,
  EdgeEncodeUri,
  EdgeParsedUri
} from 'edge-core-js'

import bcoin from 'bcoin'
// $FlowFixMe
import buffer from 'buffer-hack'
import { CurrencyEngine } from '../engine/currencyEngine.js'
import { PluginState } from './pluginState.js'
import { parseUri, encodeUri } from '../utils/uri.js'

// $FlowFixMe
const { Buffer } = buffer

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyPlugin {
  currencyInfo: EdgeCurrencyInfo
  network: string
  pluginName: string
  io: EdgeIo
  state: PluginState

  // ------------------------------------------------------------------------
  // Private API
  // ------------------------------------------------------------------------
  constructor (options: EdgeCorePluginOptions, currencyInfo: EdgeCurrencyInfo) {
    // Validate that we are a valid EdgeCurrencyPlugin:
    // eslint-disable-next-line no-unused-vars
    const test: EdgeCurrencyPlugin = this

    // Public API:
    this.currencyInfo = currencyInfo
    this.network = this.currencyInfo.defaultSettings.network.type
    this.pluginName = this.currencyInfo.pluginName
    console.log(`Creating Currency Plugin for ${this.pluginName}`)
    // Private API:
    this.io = options.io
    this.state = new PluginState(this.io, currencyInfo)
  }

  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------
  createPrivateKey (walletType: string) {
    const randomBuffer = Buffer.from(this.io.random(32))
    const mnemonic = bcoin.hd.Mnemonic.fromEntropy(randomBuffer)
    return {
      [`${this.network}Key`]: mnemonic.getPhrase()
    }
  }

  async derivePublicKey (walletInfo: EdgeWalletInfo) {
    if (!~this.currencyInfo.walletTypes.indexOf(walletInfo.type)) {
      throw new Error('InvalidWalletType')
    }
    if (!walletInfo.keys) throw new Error('InvalidKeyName')
    const seed = walletInfo.keys[`${this.network}Key`]
    if (!seed) throw new Error('InvalidKeyName')
    const mnemonic = bcoin.hd.Mnemonic.fromPhrase(seed)
    // TODO: Allow fromMnemonic to be async. API needs to change -paulvp
    let privateKey
    const result = bcoin.hd.PrivateKey.fromMnemonic(mnemonic, this.network)
    if (typeof result.then === 'function') {
      privateKey = await Promise.resolve(result)
    } else {
      privateKey = result
    }
    return {
      [`${this.network}Key`]: walletInfo.keys[`${this.network}Key`],
      [`${this.network}Xpub`]: privateKey.xpubkey()
    }
  }

  async makeEngine (
    walletInfo: EdgeWalletInfo,
    options: EdgeCurrencyEngineOptions
  ): Promise<EdgeCurrencyEngine> {
    if (!options.optionalSettings) {
      options.optionalSettings = {}
    }
    options.optionalSettings.io = this.io
    if (!options.walletLocalFolder) {
      throw new Error('Cannot create an engine without a local folder')
    }
    const engine = new CurrencyEngine(
      walletInfo,
      this.currencyInfo,
      this.state,
      options
    )
    await engine.load()
    return engine
  }

  parseUri (uri: string): EdgeParsedUri {
    return parseUri(uri, this.currencyInfo)
  }

  encodeUri (obj: EdgeEncodeUri): string {
    return encodeUri(obj, this.currencyInfo)
  }
}
