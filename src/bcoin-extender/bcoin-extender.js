// @flow
import type {
  AbcCurrencyInfo
} from 'airbitz-core-types'

export const bcoinExtender = (bcoin: any, pluginsInfo: Array<AbcCurrencyInfo>) => {
  for (const pluginInfo: AbcCurrencyInfo of pluginsInfo) {
    const type = pluginInfo.defaultSettings.network.type
    bcoin.networks.types.push(type)
    bcoin.networks[type] = pluginInfo.defaultSettings.network
  }
}
