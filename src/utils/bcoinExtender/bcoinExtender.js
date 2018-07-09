// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import {
  patchDerivePublic,
  patchDerivePrivate,
  patchDerivePath,
  patchPrivateFromMnemonic
} from './deriveExtender.js'
import { patchTransaction } from './replayProtection.js'

let cryptoReplaced = false
let replayProtectionPatched = false

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
  if (!replayProtectionPatched && network.replayProtection) {
    patchTransaction(bcoin)
    replayProtectionPatched = true
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
