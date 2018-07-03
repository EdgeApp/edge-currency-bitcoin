// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import { secp256k1Patch, pbkdf2Patch } from './asyncCrypto.js'
import { patchTransaction } from './replayProtaction.js'

let cryptoPatched = false
let replayProtactionPatched = false

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
    bcoin.networks[type] = { ...bcoin.networks.main, ...network }
  }
  if (!replayProtactionPatched && network.replayProtaction) {
    patchTransaction(bcoin)
    replayProtactionPatched = true
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
