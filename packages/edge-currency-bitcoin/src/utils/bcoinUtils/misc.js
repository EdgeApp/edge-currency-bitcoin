// @flow

import bcoin from 'bcoin'
import { type EdgeFreshAddress } from 'edge-core-js'
import { Core } from 'nidavellir'
import { toLegacyFormat } from '../addressFormat/addressFormatIndex.js'
import { type EdgeAddress } from '../../../types/bcoinUtils.js'

const { Lock } = bcoin.utils

export const scriptTypesToEdgeTypes = (
  addresses: EdgeAddress,
  network: string
): EdgeFreshAddress => {
  const publicAddress = addresses['P2WPKH-P2SH'] || addresses['P2PKH']
  const segwitAddress = addresses['P2WPKH']
  // kylan functionUsage - toLegacyFormat - scriptTypesToEdgeTypes
  const legacyAddress = toLegacyFormat(publicAddress, network)
  return { publicAddress, segwitAddress, legacyAddress }
}

export const formatToBips = (
  network: string,
  format?: string
): Array<number> => {
  const { bips } = Core.Networks[network]
  if (!format) {
    if (bips.includes(49)) return [49]
    return [44]
  }
  const bip = parseInt(format.replace('bip', ''))

  if (!bips.includes(bip)) {
    throw new Error('InvalidWalletType')
  }
  return [bip]
}

export const verifyUriProtocol = (
  protocol: string | null,
  network: string,
  pluginName: string
) => {
  const { addressPrefix } = Core.Networks[network]
  if (protocol) {
    const prot = protocol.replace(':', '').toLowerCase()
    return prot === pluginName || prot === addressPrefix.cashAddress
  }
  return true
}

export const getLock = () => new Lock()
