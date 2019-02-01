// @flow

import bcoin from 'bcoin'
import type { NetworkInfo } from '../bcoinUtils/types.js'
import { getHDSettings } from './bips.js'
import { patchPbkdf2, patchSecp256k1 } from './patchCrypto.js'
import { patchTransaction } from './replayProtection.js'

let cryptoReplaced = false
patchTransaction(bcoin)

export const addNetwork = (networkInfo: NetworkInfo) => {
  const { supportedBips, keyPrefix, type } = networkInfo
  if (bcoin.networks.types.indexOf(type) === -1) {
    bcoin.networks.types.push(type)
    const hdSettings = getHDSettings(supportedBips, keyPrefix.coinType)
    const scriptTemplates = {
      addresses: [],
      purpose: 0,
      path: () => '',
      nested: false,
      witness: false,
      scriptType: ''
    }
    bcoin.networks[type] = {
      ...bcoin.networks.main,
      ...networkInfo,
      hdSettings,
      scriptTemplates
    }
  }
}

export const patchCrypto = (secp256k1?: any = null, pbkdf2?: any = null) => {
  if (!cryptoReplaced) {
    if (secp256k1) {
      patchSecp256k1(bcoin, secp256k1)
      cryptoReplaced = true
    }
    if (pbkdf2) {
      patchPbkdf2(bcoin, pbkdf2)
      cryptoReplaced = true
    }
  }
}
