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
import { CurrencyEngine, type EngineCurrencyInfo } from '../engine/currencyEngine.js'
import { PluginState } from './pluginState.js'
import { parseUri, encodeUri } from './uri.js'
import { getXPubFromSeed } from '../utils/formatSelector.js'
import { seedFromEntropy, keysFromWalletInfo } from '../utils/coinUtils.js'
import { addNetwork, patchCrypto, type BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'

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
  engineInfo: EngineCurrencyInfo
  network: string
  pluginName: string
  io: EdgeIo
  state: PluginState

  // ------------------------------------------------------------------------
  // Private API
  // ------------------------------------------------------------------------
  constructor ({ io }: EdgeCorePluginOptions, { currencyInfo, engineInfo }: CurrencyPluginSettings) {
    // Validate that we are a valid EdgeCurrencyPlugin:
    // eslint-disable-next-line no-unused-vars
    const test: EdgeCurrencyPlugin = this

    // Public API:
    this.currencyInfo = currencyInfo
    this.pluginName = currencyInfo.pluginName
    console.log(`Creating Currency Plugin for ${this.pluginName}`)
    // Private API:
    this.io = io
    this.engineInfo = engineInfo
    this.network = engineInfo.network
    const { defaultSettings, pluginName, currencyCode } = this.currencyInfo
    const { infoServer = '' } = engineInfo
    this.state = new PluginState({ io, defaultSettings, infoServer, currencyCode, pluginName })
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
    return { ...walletInfo.keys, [`${network}Xpub`]: xpub }
  }

  async makeEngine (
    walletInfo: EdgeWalletInfo,
    options: EdgeCurrencyEngineOptions
  ): Promise<EdgeCurrencyEngine> {
    const engine = new CurrencyEngine({
      walletInfo,
      engineInfo: this.engineInfo,
      pluginState: this.state,
      options,
      io: this.io
    })
    await engine.load()
    return engine
  }

  parseUri (uri: string): EdgeParsedUri {
    return parseUri(uri, this.network, this.currencyInfo)
  }

  encodeUri (obj: EdgeEncodeUri): string {
    return encodeUri(obj, this.network, this.currencyInfo)
  }

  // getSplittableTypes (walletInfo: AbcWalletInfo) {
  //   let format = walletInfo.type.split('-')[1]
  //   if (!format || format === '') {
  //     format = walletInfo.keys && walletInfo.keys.format
  //   }
  //   const allowed = this.currencyInfo.splittableTypes.filter(type => {
  //     return format === '' || !format || format === 'bip32'
  //       ? !type.includes('bip')
  //       : type.includes(format)
  //   })
  //   return allowed
  // }
}

export const makeCurrencyPluginFactory = ({
  currencyInfo,
  engineInfo,
  bcoinInfo
}: CurrencyPluginFactorySettings) => {
  addNetwork(bcoinInfo)
  return {
    pluginType: 'currency',
    currencyInfo: currencyInfo,
    pluginName: currencyInfo.pluginName,
    makePlugin: async (options: EdgeCorePluginOptions): Promise<EdgeCurrencyPlugin> => {
      // Create a core plugin given the currencyInfo and plugin options
      const plugin = new CurrencyPlugin(options, { currencyInfo, engineInfo })
      // Extend bcoin to support this plugin currency info
      // and faster crypto if possible
      const { io: { secp256k1, pbkdf2 } = {} } = options
      patchCrypto(secp256k1, pbkdf2)
      // Return the plugin after it finished loading from cache
      return plugin.state.load().then(() => plugin)
    }
  }
}
