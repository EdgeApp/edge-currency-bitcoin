// @flow

import bcoin from 'bcoin'
import type { NetworkInfo } from 'nidavellir'
import { patchTransaction } from './replayProtection.js'
// $FlowFixMe
import * as UnsafeNetworks from '@nidavellir/networks-unsafe'
import { Core } from 'nidavellir'

let loadedUnsafe = false
patchTransaction(bcoin)

export const addNetwork = (network: string, networkInfo: NetworkInfo) => {
  if (!loadedUnsafe) {
    const scriptProto = bcoin.script.prototype
    const getPubkey = scriptProto.getPubkey
    scriptProto.getPubkey = function (minimal) {
      if (this.code.length === 6) {
        const size = this.getLength(4)

        if (
          (size === 33 || size === 65) &&
          this.getOp(5) === parseInt('ac', 16)
        ) {
          return this.getData(4)
        }
      }
      return getPubkey.call(this, minimal)
    }
    Core.NetworkInfo.addNetworks(UnsafeNetworks)
    loadedUnsafe = true
  }
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
      // serializers: {
      //   ...networkInfo.serializers,
      //   signatureHash: networkInfo.serializers.sigHash
      // },
      scriptTemplates
    }
  }
}
