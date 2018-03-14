// @flow
import type {
  AbcCorePluginOptions,
  AbcCurrencyInfo,
  AbcCurrencyPlugin,
  AbcCurrencyPluginFactory
} from 'edge-core-js'
import bcoin from 'bcoin'

// Coins Plugin Info
import * as currencyInfos from './info/currencyInfo.js'

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
      currencyInfo.splittableTypes = []
      currencyInfo.defaultSettings.forks = currencyInfo.defaultSettings.forks || []
      currencyInfo.defaultSettings.forks.forEach(fork => {
        if (currencyInfos[fork]) {
          const types = currencyInfos[fork].walletTypes
          currencyInfo.splittableTypes = currencyInfo.splittableTypes.concat(types)
        }
      })
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
export const bitcoinCurrencyPluginFactory = makePluginFactory(currencyInfos.bitcoin)

// Bitcoin Testnet:
export const bitcoinTestnetCurrencyPluginFactory = makePluginFactory(
  currencyInfos.bitcoinTestnet
)

// Bitcoin Cash:
export const bitcoincashCurrencyPluginFactory = makePluginFactory(
  currencyInfos.bitcoincash
)

// Bitcoin Cash Testnet:
export const bitcoincashTestnetCurrencyPluginFactory = makePluginFactory(
  currencyInfos.bitcoincashTestnet
)

// Dash:
export const dashCurrencyPluginFactory = makePluginFactory(currencyInfos.dash)
// Such Dogecoin:
export const dogecoinCurrencyPluginFactory = makePluginFactory(currencyInfos.dogecoin)

// Litecoin:
export const litecoinCurrencyPluginFactory = makePluginFactory(currencyInfos.litecoin)

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
