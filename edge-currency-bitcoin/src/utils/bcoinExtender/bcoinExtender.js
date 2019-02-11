// @flow

import bcoin from 'bcoin'
import type { FullNetworkInfo } from 'perian'
import { patchPbkdf2, patchSecp256k1 } from './patchCrypto.js'
import { patchTransaction } from './replayProtection.js'

let cryptoReplaced = false
patchTransaction(bcoin)

export const addNetwork = (network: string, networkInfo: FullNetworkInfo) => {
  if (bcoin.networks.types.indexOf(network) === -1) {
    bcoin.networks.types.push(network)
    const scriptTemplates = {
      addresses: [],
      purpose: 0,
      path: () => '',
      nested: false,
      witness: false,
      scriptType: ''
    }
    bcoin.networks[network] = {
      ...bcoin.networks.main,
      ...networkInfo,
      serializers: {
        ...networkInfo.serializers,
        signatureHash: networkInfo.serializers.sigHash
      },
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
