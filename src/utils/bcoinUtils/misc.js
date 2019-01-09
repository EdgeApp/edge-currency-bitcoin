// @flow
import type { EdgeFreshAddress } from 'edge-core-js'
import type { NetworkSettings, BcoinHDConf, Addresses } from './types.js'
import { utils, networks } from 'bcoin'

export const scriptTypeToBcoin = (
  scriptType?: string = 'P2PKH'
): BcoinHDConf => ({
  nested: scriptType === 'P2WPKH-P2SH',
  witness: scriptType === 'P2WPKH-P2SH' || scriptType === 'P2WPKH'
})

export const scriptTypesToEdgeTypes = (
  addresses: Addresses
): EdgeFreshAddress => ({
  publicAddress: addresses['P2PKH'],
  segwitAddress: addresses['P2WPKH'] || addresses['P2WPKH-P2SH']
})

export const defaultScriptType = (network: string): string => {
  const { hdSettings, supportedBips } = getNetworkSettings(network)
  for (const bip of supportedBips) {
    const scriptType = hdSettings[`${bip}`].scriptType
    if (scriptType) return scriptType
  }
  return 'P2PKH'
}

export const verifyUriProtocol = (
  protocol: string | null,
  network: string,
  pluginName: string
) => {
  const { addressPrefix } = getNetworkSettings(network)
  if (protocol) {
    const prot = protocol.replace(':', '').toLowerCase()
    return prot === pluginName || prot === addressPrefix.cashAddress
  }
  return true
}

export const getLock = () => new utils.Lock()

export const getNetworkSettings = (network: string): NetworkSettings => {
  const {
    hdSettings,
    scriptTemplates,
    forks = [],
    supportedBips = [],
    serializers = {},
    addressPrefix
  } = networks[network] || {}
  return {
    hdSettings,
    scriptTemplates,
    forks,
    supportedBips,
    serializers,
    addressPrefix
  }
}
