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

// $FlowFixMe
import buffer from 'buffer-hack'
import { CurrencyEngine } from '../engine/currencyEngine.js'
import { PluginState } from './pluginState.js'
import { parseUri, encodeUri } from './uri.js'
import { getXPubFromSeed } from '../utils/formatSelector.js'
import { seedFromEntropy, keysFromWalletInfo } from '../utils/coinUtils.js'
import { bcoinExtender } from '../utils/bcoinExtender/bcoinExtender.js'
import bcoin from 'bcoin'

const { Buffer } = buffer

export type CurrencyPluginFactorySettings = {
  currencyInfo: EdgeCurrencyInfo,
  engineInfo: EngineCurrencyInfo,
  bcoinInfo: BcoinCurrencyInfo
}

export type CurrencyPluginSettings = {
  currencyInfo: EdgeCurrencyInfo,
  engineInfo: EngineCurrencyInfo
}

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
    return { [`${this.network}Key`]: seedFromEntropy(randomBuffer) }
  }

  async derivePublicKey (walletInfo: EdgeWalletInfo) {
    if (!~this.currencyInfo.walletTypes.indexOf(walletInfo.type)) {
      throw new Error('InvalidWalletType')
    }
    if (!walletInfo.keys) throw new Error('InvalidKeyName')
    const network = this.network
    const { seed, bip, coinType } = keysFromWalletInfo(network, walletInfo)
    if (!seed) throw new Error('InvalidKeyName')
    const xpub = await getXPubFromSeed({ seed, bip, coinType, network })
    return {
      [`${network}Key`]: walletInfo.keys[`${network}Key`],
      [`${network}Xpub`]: xpub
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

export class CurrencyPluginFactory {
  pluginType: string
  pluginName: string
  currencyInfo: EdgeCurrencyInfo

  constructor (currencyInfo: EdgeCurrencyInfo) {
    this.pluginType = 'currency'
    this.currencyInfo = currencyInfo
    this.pluginName = currencyInfo.pluginName
  }

  async makePlugin (options: EdgeCorePluginOptions): Promise<EdgeCurrencyPlugin> {
    // Create a core plugin given the currencyInfo and plugin options
    const plugin = new CurrencyPlugin(options, this.currencyInfo)
    // Extend bcoin to support this plugin currency info
    // and faster crypto if possible
    const { io: { secp256k1, pbkdf2 } = {} } = options
    bcoinExtender(bcoin, this.currencyInfo, secp256k1, pbkdf2)
    // Return the plugin when after it finished loading it's cache
    return plugin.state.load().then(() => plugin)
  }
}
