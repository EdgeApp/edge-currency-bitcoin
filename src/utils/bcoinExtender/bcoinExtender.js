// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import { patchBcashTX } from './bcashExtender.js'
import { secp256k1Patch, pbkdf2Patch } from './asyncCrypto.js'

let patchedForCash = false
let cryptoPatched = false

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
  if (!cryptoPatched) {
    if (secp256k1) {
      secp256k1Patch(bcoin, secp256k1)
      cryptoPatched = true
    }
    if (pbkdf2) {
      pbkdf2Patch(bcoin, pbkdf2)
      cryptoPatched = true
    }
  }
}
