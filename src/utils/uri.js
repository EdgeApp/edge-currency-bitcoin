// @flow
import type { AbcEncodeUri, AbcParsedUri, AbcCurrencyInfo } from 'edge-core-js'
import {
  validAddress,
  sanitizeAddress,
  dirtyAddress,
  toNewFormat
} from './addressFormat/addressFormatIndex.js'
import { parse, serialize } from 'uri-js'
import { bns } from 'biggystring'
import bcoin from 'bcoin'

const getParameterByName = (param: string, url: string) => {
  const name = param.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

const isSeed = (seed: string) => {
  try {
    bcoin.hd.Mnemonic.fromPhrase(seed)
    return true
  } catch (e) {
    return false
  }
}

const isMasterPriv = (privateKey: string, network: string) => {
  try {
    bcoin.hd.PrivateKey.fromBase58(privateKey, network)
    return true
  } catch (e) {}
  return false
}

const isWif = (privateKey: string, network: string) => {
  try {
    bcoin.primitives.KeyRing.fromSecret(privateKey, network)
    return true
  } catch (e) {}
  return false
}

const parseAddress = (address: string, network: string) => {
  const parsedAddress = {}
  let legacyAddress = ''
  address = address.replace('/', '') // Remove any slashes
  address = dirtyAddress(address, network)
  if (!validAddress(address, network)) {
    address = sanitizeAddress(address, network)
    legacyAddress = address
    address = toNewFormat(address, network)
    if (!validAddress(address, network)) {
      throw new Error('InvalidPublicAddressError')
    }
    parsedAddress.publicAddress = address
    parsedAddress.legacyAddress = legacyAddress
  } else {
    parsedAddress.publicAddress = address
  }
  return parsedAddress
}

const parseHost = (uri: string, currencyInfo: AbcCurrencyInfo) => {
  const network = currencyInfo.defaultSettings.network.type
  if (isSeed(uri)) return { seed: uri }
  if (isMasterPriv(uri, network)) return { masterPriv: uri }
  if (isWif(uri, network)) return { privateKeys: [uri] }
  const parsedUri = parse(uri)
  if (
    parsedUri.scheme &&
    parsedUri.scheme.toLowerCase() !== currencyInfo.currencyName.toLowerCase()
  ) {
    throw new Error('InvalidUriError')
  }
  const host = parsedUri.host || parsedUri.path
  if (!host) throw new Error('InvalidUriError')
  return parseAddress(host, network)
}

const parseNativeAmount = (uri: string, currencyInfo: AbcCurrencyInfo) => {
  const nativeAmount = {}
  const amountStr = getParameterByName('amount', uri)
  if (amountStr && typeof amountStr === 'string') {
    const { denominations, currencyCode } = currencyInfo
    const denomination = denominations.find(e => e.name === currencyCode)
    if (denomination) {
      const { multiplier = '1' } = denomination
      const t = bns.mul(amountStr, multiplier.toString())
      nativeAmount.nativeAmount = bns.toFixed(t, 0, 0)
      nativeAmount.currencyCode = currencyCode
    }
  }
  return nativeAmount
}

const parseMetadata = (uri: string, currencyInfo: AbcCurrencyInfo) => {
  const metadata = {}
  const name = getParameterByName('label', uri)
  const message = getParameterByName('message', uri)
  if (name) metadata.name = name
  if (message) metadata.message = message
  return metadata
}

export const parseUri = (
  uri: string,
  currencyInfo: AbcCurrencyInfo
): AbcParsedUri => {
  const host = parseHost(uri, currencyInfo)
  const metadata = parseMetadata(uri, currencyInfo)
  const nativeAmount = parseNativeAmount(uri, currencyInfo)
  return {
    metadata,
    ...host,
    ...nativeAmount
  }
}

export const encodeUri = (
  obj: AbcEncodeUri,
  currencyInfo: AbcCurrencyInfo
): string => {
  const { legacyAddress } = obj
  let { publicAddress } = obj
  const network = currencyInfo.defaultSettings.network.type
  if (
    legacyAddress &&
    validAddress(toNewFormat(legacyAddress, network), network)
  ) {
    publicAddress = legacyAddress
  } else if (publicAddress && validAddress(publicAddress, network)) {
    publicAddress = dirtyAddress(publicAddress, network)
  } else {
    throw new Error('InvalidPublicAddressError')
  }
  if (!obj.nativeAmount && !obj.metadata) return publicAddress
  publicAddress = sanitizeAddress(publicAddress, network)
  let queryString = ''
  if (obj.nativeAmount) {
    const code = obj.currencyCode || currencyInfo.currencyCode
    const denomination: any = currencyInfo.denominations.find(
      e => e.name === code
    )
    const multiplier: string = denomination.multiplier.toString()
    // $FlowFixMe
    const amount = bns.div(obj.nativeAmount, multiplier, 8)
    queryString += 'amount=' + amount.toString() + '&'
  }
  if (obj.metadata) {
    // $FlowFixMe
    if (obj.metadata.name) queryString += `label=${obj.metadata.name}&`
    if (obj.metadata.message) {
      // $FlowFixMe
      queryString += `message=${obj.metadata.message}&`
    }
  }
  queryString = queryString.substr(0, queryString.length - 1)

  return serialize({
    scheme: currencyInfo.currencyName.toLowerCase(),
    path: publicAddress,
    query: queryString
  })
}
