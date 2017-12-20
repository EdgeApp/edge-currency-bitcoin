// @flow
import type { AbcCurrencyInfo } from 'airbitz-core-types'
import { patchBachAddress, patchBcashTX } from './bcashExtender.js'
import { derivePublic, derivePrivate } from './deriveExtender.js'

let cryptoReplaced = false

export const bcoinExtender = (
  bcoin: any,
  pluginsInfo: AbcCurrencyInfo,
  secp256k1?: any = null
) => {
  const network = pluginsInfo.defaultSettings.network
  const type = network.type
  if (bcoin.networks.types.indexOf(type) === -1) {
    bcoin.networks.types.push(type)
    for (const param in bcoin.networks.main) {
      if (!network[param]) {
        network[param] = bcoin.networks.main[param]
      }
    }
    bcoin.networks[type] = network
  }
  if (type && type.includes('bitcoincash')) {
    patchBachAddress(bcoin)
    patchBcashTX(bcoin)
  }
  if (!cryptoReplaced && secp256k1) {
    derivePublic(bcoin, secp256k1)
    derivePrivate(bcoin, secp256k1)
    cryptoReplaced = true
  }
}
