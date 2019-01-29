// $FlowFixMe
import buffer from 'buffer-hack'
// @flow
import type {
  EdgeCorePluginOptions,
  EdgeCreatePrivateKeyOptions,
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyInfo,
  EdgeCurrencyPlugin,
  EdgeEncodeUri,
  EdgeIo,
  EdgeParsedUri,
  EdgeWalletInfo
} from 'edge-core-js'

import {
  CurrencyEngine,
  type EngineCurrencyInfo
} from '../engine/currencyEngine.js'
// import { Networks } from '../coinUtils/network.js'
import {
  addNetwork,
  patchCrypto
} from '../utils/bcoinExtender/bcoinExtender.js'
import { getXPubFromSeed, keysFromEntropy } from '../utils/bcoinUtils/key.js'
import { getNetworkSettings } from '../utils/bcoinUtils/misc.js'
import type { NetworkInfo } from '../utils/bcoinUtils/types.js'
import { PluginState } from './pluginState.js'
import { encodeUri, parseUri } from './uri.js'

const { Buffer } = buffer

export type CurrencyPluginFactorySettings = {
  currencyInfo: EdgeCurrencyInfo,
  engineInfo: EngineCurrencyInfo,
  bcoinInfo: NetworkInfo
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
  constructor (
    { io }: EdgeCorePluginOptions,
    { currencyInfo, engineInfo }: CurrencyPluginSettings
  ) {
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
    this.state = new PluginState({
      io,
      files: { headers: 'headers.json', serverCache: 'serverCache.json' },
      defaultSettings,
      currencyCode,
      pluginName
    })
  }
  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------
  createPrivateKey (walletType: string, opts?: EdgeCreatePrivateKeyOptions) {
    const randomBuffer = Buffer.from(this.io.random(32))
    return keysFromEntropy(randomBuffer, this.network, opts)
  }

  async derivePublicKey (walletInfo: EdgeWalletInfo) {
    if (!walletInfo.keys) throw new Error('InvalidKeyName')
    const network = this.network
    const { coinType = -1 } = walletInfo.keys
    const seed = walletInfo.keys[`${network}Key`] || ''
    if (!seed) throw new Error('InvalidKeyName')
    const xpub = await getXPubFromSeed({
      seed,
      network,
      coinType
    })
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

  getSplittableTypes (walletInfo: EdgeWalletInfo): Array<string> {
    const { keys: { format = 'bip32' } = {} } = walletInfo
    const { forks } = getNetworkSettings(this.network)
    const bip = parseInt(format.replace('bip', ''))
    return forks
      .filter(network =>
        getNetworkSettings(network).supportedBips.includes(bip)
      )
      .map(network => `wallet:${network}`)
  }

  async changeSettings (settings: Object): Promise<mixed> {
    return this.state.updateServers(settings)
  }
}

export const makeCurrencyPluginFactory = ({
  currencyInfo,
  engineInfo,
  bcoinInfo
}: CurrencyPluginFactorySettings) => {
  addNetwork(bcoinInfo)
  // Networks[bcoinInfo.type] = { ...bcoinInfo }
  currencyInfo = {
    walletTypes: [`wallet:${currencyInfo.pluginName}`],
    ...currencyInfo
  }
  return {
    pluginType: 'currency',
    currencyInfo,
    pluginName: currencyInfo.pluginName,
    makePlugin: async (
      options: EdgeCorePluginOptions
    ): Promise<EdgeCurrencyPlugin> => {
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
