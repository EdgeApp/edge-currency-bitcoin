import { CurrencyPluginFactory } from './plugin/currencyPlugin.js'

import { bitcoinInfo } from './info/bitcoin'
import { bitcoinTestnetInfo } from './info/bitcointestnet'
import { bitcoincashInfo } from './info/bitcoincash'
import { bitcoincashTestnetInfo } from './info/bitcoincashtestnet'
import { litecoinInfo } from './info/litecoin'
import { dashInfo } from './info/dash'
import { feathercoinInfo } from './info/feathercoin'
import { qtumInfo } from './info/qtum'
import { ufoInfo } from './info/ufo'
import { zcoinInfo } from './info/zcoin'

export const bitcoinCurrencyPluginFactory = new CurrencyPluginFactory(bitcoinInfo)
export const bitcoinTestnetCurrencyPluginFactory = new CurrencyPluginFactory(bitcoinTestnetInfo)
export const bitcoincashCurrencyPluginFactory = new CurrencyPluginFactory(bitcoincashInfo)
export const bitcoincashTestnetCurrencyPluginFactory = new CurrencyPluginFactory(bitcoincashTestnetInfo)
export const litecoinCurrencyPluginFactory = new CurrencyPluginFactory(litecoinInfo)
export const dashCurrencyPluginFactory = new CurrencyPluginFactory(dashInfo)
export const feathercoinCurrencyPluginFactory = new CurrencyPluginFactory(feathercoinInfo)
export const qtumCurrencyPluginFactory = new CurrencyPluginFactory(qtumInfo)
export const ufoCurrencyPluginFactory = new CurrencyPluginFactory(ufoInfo)
export const zcoinCurrencyPluginFactory = new CurrencyPluginFactory(zcoinInfo)
