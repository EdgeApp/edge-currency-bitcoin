// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import { patchBcashTX } from './bcashExtender.js'
import {
  patchDerivePublic,
  patchDerivePrivate,
  patchDerivePath,
  patchPrivateFromMnemonic
} from './deriveExtender.js'

let cryptoReplaced = false
let patchedForCash = false

export const bcoinExtender = (
  bcoin: any,
  pluginsInfo: EdgeCurrencyInfo,
  secp256k1?: any = null,
  pbkdf2?: any = null
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
  if (!patchedForCash && type && type.includes('bitcoincash')) {
    patchBcashTX(bcoin)
    patchedForCash = true
  }
  if (!cryptoReplaced) {
    if (secp256k1) {
      patchDerivePublic(bcoin, secp256k1)
      patchDerivePrivate(bcoin, secp256k1)
      patchDerivePath(bcoin)
      cryptoReplaced = true
    }
    if (pbkdf2) {
      patchPrivateFromMnemonic(bcoin, pbkdf2)
      cryptoReplaced = true
    }
  }
}
