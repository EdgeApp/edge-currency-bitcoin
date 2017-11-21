// @flow
import type { AbcCurrencyInfo } from 'airbitz-core-types'

export const bcoinExtender = (
  bcoin: any,
  pluginsInfo: Array<AbcCurrencyInfo>
) => {
  for (const { defaultSettings: { network } } of pluginsInfo) {
    const type = network.type
    bcoin.networks.types.push(type)
    for (const param in bcoin.networks.main) {
      if (!network[param]) {
        network[param] = bcoin.networks.main[param]
      }
    }
    bcoin.networks[type] = network
  }
}
