// @flow
import type { AbcCurrencyInfo } from 'airbitz-core-types'
// import bcashaddress from './bcashaddress.js'

const patchBachAddress = (bcoin) => {
  const addressProto = bcoin.primitives.Address.prototype
  const toBase58 = addressProto.toBase58
  addressProto.toBase58 = function (network) {
    // if (network && network.includes('bitcoincash')) {
    //   const version = this.version
    //   const hash = this.hash
    //   network = bcoin.network.get(network)
    //   const prefix = network.newAddressFormat.prefix

    //   return bcashaddress.encode(prefix, version, hash)
    // }
    return toBase58.call(this, network)
  }
}

export const bcoinExtender = (
  bcoin: any,
  pluginsInfo: Array<AbcCurrencyInfo>
) => {
  let bcashPatch = false
  for (const { defaultSettings: { network } } of pluginsInfo) {
    const type = network.type
    bcoin.networks.types.push(type)
    for (const param in bcoin.networks.main) {
      if (!network[param]) {
        network[param] = bcoin.networks.main[param]
      }
    }
    bcoin.networks[type] = network
    if (!bcashPatch && type && type.includes('bitcoincash')) {
      patchBachAddress(bcoin)
      bcashPatch = true
    }
  }
}
