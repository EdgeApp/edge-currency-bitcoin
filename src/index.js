// @flow
import type {
  AbcCorePluginOptions,
  AbcCurrencyInfo,
  AbcCurrencyPlugin,
  AbcCurrencyPluginFactory
} from 'airbitz-core-types'
import bcoin from 'bcoin'

// Coins Plugin Info
import { bitcoinInfo } from './info/bitcoin.js'
import { bitcoincashInfo } from './info/bitcoincash.js'
import { bitcoincashTestnetInfo } from './info/bitcoincashtestnet.js'
import { bitcoinTestnetInfo } from './info/bitcointestnet.js'
import { dashInfo } from './info/dash.js'
import { dogecoinInfo } from './info/dogecoin.js'
import { litecoinInfo } from './info/litecoin.js'

// CurrencyPlugin takes a plugin info and creates the plugin
import { CurrencyPlugin } from './plugin/plugin-api.js'

// Bcoin extender function
import { bcoinExtender } from './utils/bcoin-extender'

const pluginsInfo = [
  bitcoinInfo,
  bitcoinTestnetInfo,
  bitcoincashInfo,
  bitcoincashTestnetInfo,
  dashInfo,
  dogecoinInfo,
  litecoinInfo
]

// Extend bcoin to support all coins we have info for
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

// Bitcoin Testnet:
export const bitcoinTestnetCurrencyPluginFactory = makePluginFactory(
  bitcoinTestnetInfo
)

// Bitcoin Cash:
export const bitcoincashCurrencyPluginFactory = makePluginFactory(
  bitcoincashInfo
)

// Bitcoin Cash Testnet:
export const bitcoincashTestnetCurrencyPluginFactory = makePluginFactory(
  bitcoincashTestnetInfo
)

// Dash:
export const dashCurrencyPluginFactory = makePluginFactory(dashInfo)
// Such Dogecoin:
export const dogecoinCurrencyPluginFactory = makePluginFactory(dogecoinInfo)

// Litecoin:
export const litecoinCurrencyPluginFactory = makePluginFactory(litecoinInfo)

// Legacy uppercased names:
export {
  bitcoinCurrencyPluginFactory as BitcoinCurrencyPluginFactory,
  bitcoinTestnetCurrencyPluginFactory as BitcoinTestnetCurrencyPluginFactory,
  bitcoincashCurrencyPluginFactory as BitcoincashCurrencyPluginFactory,
  bitcoincashTestnetCurrencyPluginFactory as BitcoincashTestnetCurrencyPluginFactory,
  dashCurrencyPluginFactory as DashCurrencyPluginFactory,
  dogecoinCurrencyPluginFactory as DogecoinCurrencyPluginFactory,
  litecoinCurrencyPluginFactory as LitecoinCurrencyPluginFactory
}
