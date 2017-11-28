// @flow
import type {
  AbcCorePluginOptions,
  AbcCurrencyInfo,
  AbcCurrencyPlugin,
  AbcCurrencyPluginFactory
} from 'airbitz-core-types'
import bcoin from 'bcoin'

import { bitcoinInfo } from './info/bitcoin.js'
import { bitcoincashInfo } from './info/bitcoincash.js'
import { bitcoincashTestnetInfo } from './info/bitcoincashtestnet.js'
import { bitcoinTestnetInfo } from './info/bitcointestnet.js'
import { dogecoinInfo } from './info/dogecoin.js'
import { dogecoinTestnetInfo } from './info/dogecointestnet.js'
import { litecoinInfo } from './info/litecoin.js'
import { litecoinTestnetInfo } from './info/litecointestnet.js'
import { CurrencyPlugin } from './plugin/plugin-api.js'
import { bcoinExtender } from './utils/bcoin-extender'

const pluginsInfo = [
  bitcoinInfo,
  bitcoinTestnetInfo,
  bitcoincashInfo,
  bitcoincashTestnetInfo,
  dogecoinInfo,
  dogecoinTestnetInfo,
  litecoinInfo,
  litecoinTestnetInfo
]

// Extend bcoin to support all networks inside info
bcoinExtender(bcoin, pluginsInfo)

/**
 * Makes a core plugin factory, given the currencyInfo for that coin.
 */
function makePluginFactory (
  currencyInfo: AbcCurrencyInfo
): AbcCurrencyPluginFactory {
  return {
    pluginType: 'currency',
    pluginName: currencyInfo.pluginName,

    makePlugin (options: AbcCorePluginOptions): Promise<AbcCurrencyPlugin> {
      const plugin = new CurrencyPlugin(options, currencyInfo)
      return plugin.state.load().then(() => plugin)
    }
  }
}

export const bitcoinPluginFactory = makePluginFactory(bitcoinInfo)
export const bitcoinTestnetPluginFactory = makePluginFactory(bitcoinTestnetInfo)
export const bitcoincashPluginFactory = makePluginFactory(bitcoincashInfo)
export const bitcoincashTestnetPluginFactory = makePluginFactory(
  bitcoincashTestnetInfo
)
export const dogecoinPluginFactory = makePluginFactory(dogecoinInfo)
export const dogecoinTestnetPluginFactory = makePluginFactory(
  dogecoinTestnetInfo
)
export const litecoinPluginFactory = makePluginFactory(litecoinInfo)
export const litecoinTestnetPluginFactory = makePluginFactory(
  litecoinTestnetInfo
)

// Deprecated names
export const BitcoincashPluginFactory = bitcoincashPluginFactory
export const BitcoincashTestnetPluginFactory = bitcoincashTestnetPluginFactory
export const BitcoinPluginFactory = bitcoinPluginFactory
export const BitcoinTestnetPluginFactory = bitcoinTestnetPluginFactory
export const DogecoinPluginFactory = dogecoinPluginFactory
export const DogecoinTestnetPluginFactory = dogecoinTestnetPluginFactory
export const LitecoinPluginFactory = litecoinPluginFactory
export const LitecoinTestnetPluginFactory = litecoinTestnetPluginFactory
