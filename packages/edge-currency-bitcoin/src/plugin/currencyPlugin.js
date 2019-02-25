// @flow

import { Buffer } from 'buffer'

import {
  type EdgeCorePluginOptions,
  type EdgeCorePlugins,
  type EdgeCreatePrivateKeyOptions,
  type EdgeCurrencyEngine,
  type EdgeCurrencyEngineOptions,
  type EdgeCurrencyInfo,
  type EdgeCurrencyPlugin,
  type EdgeCurrencyTools,
  type EdgeEncodeUri,
  type EdgeParsedUri,
  type EdgeWalletInfo
} from 'edge-core-js/types'

import { allInfo } from '../info/all.js'

import { Core, HD } from 'nidavellir'
import {
  CurrencyEngine,
  type EngineCurrencyInfo
} from '../engine/currencyEngine.js'
import { addNetwork } from '../utils/bcoinExtender/bcoinExtender.js'
import { patchCrypto } from '../utils/bcoinExtender/patchCrypto.js'
import { seedToHex, keysFromEntropy } from '../utils/bcoinUtils/key.js'
import { PluginState } from './pluginState.js'
import { encodeUri, parseUri } from './uri.js'

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyTools {
  currencyInfo: EdgeCurrencyInfo
  network: string
  pluginName: string
  io: PluginIo
  state: PluginState

  // ------------------------------------------------------------------------
  // Private API
  // ------------------------------------------------------------------------
  constructor (
    io: PluginIo,
    { currencyInfo, engineInfo }: CurrencyPluginSettings
  ) {
    // Validate that we are a valid EdgeCurrencyTools:
    // eslint-disable-next-line no-unused-vars
    const test: EdgeCurrencyTools = this

    // Public API:
    this.currencyInfo = currencyInfo
    this.pluginName = currencyInfo.pluginName
    console.log(`Creating Currency Plugin for ${this.pluginName}`)
    // Private API:
    this.io = io
    this.network = engineInfo.network
    const { defaultSettings, pluginName, currencyCode } = this.currencyInfo
    this.state = new PluginState({
      io,
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
    const seed = walletInfo.keys[`${network}Key`] || ''
    if (!seed) throw new Error('InvalidKeyName')
    const { fromSeed, toString } = HD.ExtendedKey
    const hexSeed = await seedToHex(seed, network)
    const keyPair = await fromSeed(hexSeed, network)
    const xpub = toString(keyPair, network, true)
    return { ...walletInfo.keys, [`${network}Xpub`]: xpub }
  }

  parseUri (uri: string): Promise<EdgeParsedUri> {
    return Promise.resolve(parseUri(uri, this.network, this.currencyInfo))
  }

  encodeUri (obj: EdgeEncodeUri): Promise<string> {
    return Promise.resolve(encodeUri(obj, this.network, this.currencyInfo))
  }

  getSplittableTypes (walletInfo: EdgeWalletInfo): Array<string> {
    const { keys: { format = 'bip32' } = {} } = walletInfo
    const forks = getForksForNetwork(this.network)
    return forks
      .filter(network => getFromatsForNetwork(network).includes(format))
      .map(network => `wallet:${network}`)
  }
}

const makeCurrencyPluginFactory = (
  { currencyInfo, engineInfo, bcoinInfo }: CurrencyPluginFactorySettings,
  makeIo: (opts: EdgeCorePluginOptions) => PluginIo
) => {
  addNetwork(bcoinInfo)

  return function makePlugin (
    options: EdgeCorePluginOptions
  ): EdgeCurrencyPlugin {
    const io = makeIo(options)

    // Extend bcoin to support this plugin currency info
    // and faster crypto if possible
    const { secp256k1, pbkdf2 } = io
    patchCrypto(secp256k1, pbkdf2)

    let toolsPromise: Promise<EdgeCurrencyTools> | void
    return {
      currencyInfo,

      async makeCurrencyEngine (
        walletInfo: EdgeWalletInfo,
        options: EdgeCurrencyEngineOptions
      ): Promise<EdgeCurrencyEngine> {
        const tools = await this.makeCurrencyTools()
        const engine = new CurrencyEngine({
          walletInfo,
          engineInfo,
          pluginState: tools.state,
          options,
          io
        })
        await engine.load()
        return engine
      },

      makeCurrencyTools (): Promise<EdgeCurrencyTools> {
        if (toolsPromise != null) return toolsPromise
        const tools = new CurrencyTools(io, { currencyInfo, engineInfo })
        toolsPromise = tools.state.load().then(() => tools)
        return toolsPromise
      }
    }
  }
}

export function makeEdgeCorePlugins (
  makeIo: (opts: EdgeCorePluginOptions) => PluginIo
): EdgeCorePlugins {
  const out: EdgeCorePlugins = {}
  for (const info of allInfo) {
    const pluginName = info.currencyInfo.pluginName
    out[pluginName] = makeCurrencyPluginFactory(info, makeIo)
  }
  return out
}
