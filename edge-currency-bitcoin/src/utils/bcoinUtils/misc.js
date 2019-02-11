// @flow

import { Commons } from 'perian'
import bcoin from 'bcoin'
import type { EdgeFreshAddress } from 'edge-core-js'
import type { EdgeAddress } from './types.js'

const { networks } = Commons.Network
const { Lock } = bcoin.utils

export const scriptTypesToEdgeTypes = (
  addresses: EdgeAddress
): EdgeFreshAddress => ({
  publicAddress: addresses['P2PKH'],
  segwitAddress: addresses['P2WPKH'] || addresses['P2WPKH-P2SH']
})

export const verifyUriProtocol = (
  protocol: string | null,
  network: string,
  pluginName: string
) => {
  const { addressPrefix } = networks[network]
  if (protocol) {
    const prot = protocol.replace(':', '').toLowerCase()
    return prot === pluginName || prot === addressPrefix.cashAddress
  }
  return true
}

export const getLock = () => new Lock()
