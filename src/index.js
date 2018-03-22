// @flow
import type {
  AbcCorePluginOptions,
  AbcCurrencyInfo,
  AbcCurrencyPlugin,
  AbcCurrencyPluginFactory
} from 'edge-core-js'
import bcoin from 'bcoin'

// Coins Plugin Info
import { bitcoinInfo } from './info/bitcoin.js'
import { bitcoincashInfo } from './info/bitcoincash.js'
import { bitcoincashTestnetInfo } from './info/bitcoincashtestnet.js'
import { bitcoinTestnetInfo } from './info/bitcointestnet.js'
import { dashInfo } from './info/dash.js'
import { dogecoinInfo } from './info/dogecoin.js'
import { litecoinInfo } from './info/litecoin.js'
import { zcoinInfo } from './info/zcoin.js'

// CurrencyPlugin takes a plugin info and creates the plugin
import { CurrencyPlugin } from './plugin/currencyPlugin.js'

// Bcoin extender function
import { bcoinExtender } from './utils/bcoinExtender'

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
      // Extend bcoin to support this plugin currency info
      // and faster crypto if possible
      let secp256k1 = null
      let pbkdf2 = null
      if (options.io && options.io.secp256k1) {
        secp256k1 = options.io.secp256k1
      }
      if (options.io && options.io.pbkdf2) {
        pbkdf2 = options.io.pbkdf2
      }

      bcoinExtender(bcoin, currencyInfo, secp256k1, pbkdf2)
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

// Zcoin:
export const zcoinCurrencyPluginFactory = makePluginFactory(zcoinInfo)

// Legacy uppercased names:
export {
  bitcoinCurrencyPluginFactory as BitcoinCurrencyPluginFactory,
  bitcoinTestnetCurrencyPluginFactory as BitcoinTestnetCurrencyPluginFactory,
  bitcoincashCurrencyPluginFactory as BitcoincashCurrencyPluginFactory,
  bitcoincashTestnetCurrencyPluginFactory as BitcoincashTestnetCurrencyPluginFactory,
  dashCurrencyPluginFactory as DashCurrencyPluginFactory,
  dogecoinCurrencyPluginFactory as DogecoinCurrencyPluginFactory,
  litecoinCurrencyPluginFactory as LitecoinCurrencyPluginFactory,
  zcoinCurrencyPluginFactory as ZcoinCurrencyPluginFactory
}
