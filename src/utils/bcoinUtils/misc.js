// @flow
import { utils, networks } from 'bcoin'

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

export const getNetworkSettings = (network: string) => {
  const {
    forks = [],
    supportedBips = [],
    serializers = {},
    addressPrefix = {}
  } = networks[network] || {}
  return { forks, supportedBips, serializers, addressPrefix }
}
