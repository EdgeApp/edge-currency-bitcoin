// @flow
import type {
  AbcCorePluginOptions,
  AbcCurrencyInfo,
  AbcCurrencyPlugin,
  AbcCurrencyPluginFactory
} from 'airbitz-core-types'

import { bitcoinInfo } from './info/bitcoin.js'
import { bitcoincashInfo } from './info/bitcoincash.js'
import { dogecoinInfo } from './info/dogecoin.js'
import { litecoinInfo } from './info/litecoin.js'
import { CurrencyPlugin } from './plugin/plugin-api.js'

/**
 * Makes a core plugin factory, given the currencyInfo for that coin.
 */
function makePluginFactory (
  currencyInfo: AbcCurrencyInfo
): AbcCurrencyPluginFactory {
  return {
    pluginType: 'currency',
    makePlugin (options: AbcCorePluginOptions): Promise<AbcCurrencyPlugin> {
      return Promise.resolve(new CurrencyPlugin(options, currencyInfo))
    }
  }
}

export const BitcoinPluginFactory = makePluginFactory(bitcoinInfo)
export const BitcoincashPluginFactory = makePluginFactory(bitcoincashInfo)
export const DogecoinPluginFactory = makePluginFactory(dogecoinInfo)
export const LitecoinPluginFactory = makePluginFactory(litecoinInfo)
