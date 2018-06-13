// @flow
import type {
  EdgeEncodeUri,
  EdgeParsedUri,
  EdgeCurrencyInfo
} from 'edge-core-js'
import {
  validAddress,
  sanitizeAddress,
  dirtyAddress,
  toNewFormat
} from './addressFormat/addressFormatIndex.js'
import { serialize } from 'uri-js'
import parse from 'url-parse'
import { bns } from 'biggystring'
import bcoin from 'bcoin'

const parsePathname = (pathname: string, network: string) => {
  // Check if the pathname type is a mnemonic seed
  try {
    bcoin.hd.Mnemonic.fromPhrase(pathname)
    return { seed: pathname }
  } catch (e) {}
  // Check if the pathname type is a private key
  try {
    bcoin.hd.PrivateKey.fromBase58(pathname, network)
    return { masterPriv: pathname }
  } catch (e) {}
  // Check if the pathname type is a wif
  try {
    bcoin.primitives.KeyRing.fromSecret(pathname, network)
    return { privateKeys: [pathname] }
  } catch (e) {}
  // If the pathname is non of the above, then assume it's an address and check for validity
  const parsedAddress = {}
  let address = pathname
  let legacyAddress = ''
  address = dirtyAddress(address, network)
  if (validAddress(address, network)) {
    parsedAddress.publicAddress = address
  } else {
    address = sanitizeAddress(address, network)
    legacyAddress = address
    address = toNewFormat(address, network)
    if (!validAddress(address, network)) {
      throw new Error('InvalidPublicAddressError')
    }
    parsedAddress.publicAddress = address
    parsedAddress.legacyAddress = legacyAddress
  }
  return parsedAddress
}

export const parseUri = (
  uri: string,
  currencyInfo: EdgeCurrencyInfo
): EdgeParsedUri => {
  const result: EdgeParsedUri = { metadata: {} }
  const parsedUri = parse(uri, true)
  const { protocol, pathname, query } = parsedUri
  const currencyName = currencyInfo.currencyName.toLowerCase()
  const network = currencyInfo.defaultSettings.network.type
  const currencyCode = protocol && protocol.replace(':', '')
  // If the currency URI belongs to the wrong network then error
  if (currencyCode && currencyCode.toLowerCase() !== currencyName) {
    throw new Error('InvalidUriError')
  }
  // Get all posible query params
  const { label, message, amount, r } = query
  // If we don't have a pathname or a paymentProtocolURL uri then we bail
  if (!pathname && !r) throw new Error('InvalidUriError')
  // Parse the pathname and add it to the result object
  if (pathname) {
    // Test if the currency code
    const parsedPath = parsePathname(pathname, network)
    if (!parsedPath) throw new Error('InvalidUriError')
    // $FlowFixMe
    Object.assign(result, parsedPath)
  }
  // Assign the query params to the result object
  // $FlowFixMe
  if (label) result.metadata.name = label
  // $FlowFixMe
  if (message) result.metadata.message = message
  // $FlowFixMe
  if (r) result.paymentProtocolURL = r
  // Get amount in native denomination if exists
  if (amount && typeof amount === 'string') {
    const { denominations, currencyCode } = currencyInfo
    const denomination = denominations.find(e => e.name === currencyCode)
    if (denomination) {
      const { multiplier = '1' } = denomination
      const t = bns.mul(amount, multiplier.toString())
      result.nativeAmount = bns.toFixed(t, 0, 0)
      result.currencyCode = currencyCode
    }
  }
  return result
}

export const encodeUri = (
  obj: EdgeEncodeUri,
  currencyInfo: EdgeCurrencyInfo
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
