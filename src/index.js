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

// Bitcoin:
export const bitcoinCurrencyPluginFactory = makePluginFactory(bitcoinInfo)
export const bitcoinTestnetCurrencyPluginFactory = makePluginFactory(
  bitcoinTestnetInfo
)

// Bitcoin Cash:
export const bitcoincashCurrencyPluginFactory = makePluginFactory(
  bitcoincashInfo
)
export const bitcoincashTestnetCurrencyPluginFactory = makePluginFactory(
  bitcoincashTestnetInfo
)

// Such Dogecoin:
export const dogecoinCurrencyPluginFactory = makePluginFactory(dogecoinInfo)
export const dogecoinTestnetCurrencyPluginFactory = makePluginFactory(
  dogecoinTestnetInfo
)

// Litecoin:
export const litecoinCurrencyPluginFactory = makePluginFactory(litecoinInfo)
export const litecoinTestnetCurrencyPluginFactory = makePluginFactory(
  litecoinTestnetInfo
)
