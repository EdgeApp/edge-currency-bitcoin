// @flow
import type {
  EdgeParsedUri,
  EdgeCurrencyInfo
} from 'edge-core-js'

import parse from 'url-parse'
import { FormatSelector } from '../utils/formatSelector'
import { hash256Sync } from '../utils/utils'
import { addressFromKey } from '../utils/coinUtils'

// parse bitid uri
// bitid://www.site.com/callback?x=NONCE
//
export const bitIDParseUri = (
  uri: string,
  { currencyCode }: EdgeCurrencyInfo
): EdgeParsedUri | null => {
  const uriObj = parse(uri, {}, true)
  const { protocol, pathname, query, port, hostname } = uriObj
  // check bitid protocl validation
  if (protocol !== 'bitid' && port !== 'bitid') {
    return null
  }
  // Get x (nonce) from  query
  const { x: nonce } = query
  // If we don't have a pathname or a nonce throw error
  if (!pathname && !nonce) throw new Error('InvalidUriError')
  return {
    currncyCode: currencyCode,
    bitIDURI: uri,
    bitIDDomain: hostname,
    bitIDCallbackUri: pathname
  }
}

export const deriveBitIDMakeAddress = async (index: number, bitIDURI: string, seed: string, network: string) => {
  const masterPath = biIDMakePath(bitIDURI, index)
  const masterKeys = await FormatSelector('bip32', network).getMasterKeys(seed, masterPath)
  const publicAddress = await addressFromKey(masterKeys.pubKey, network)
  return {
    ...publicAddress,
    masterPath
  }
}

export const signBitIDAddress = async (derivationPath: string, message: string, seed: string, network: string) => {
  const masterKeys = await FormatSelector('bip32', network).getMasterKeys(seed, derivationPath)
  const publicAddress = await addressFromKey(masterKeys.pubKey, network)
  const signedMesssage = masterKeys.privKey.sign(Buffer.from(message))
  return {
    signedMesssage: signedMesssage.toString('hex'),
    ...publicAddress
  }
}

export const broadcastBitIDMessage = async (
  signedMesssage: string,
  address: string,
  fetch: any,
  network: string,
  bitIDUri: string,
  bitIDCallbackUri: string
): Promise<any> => {
  const bitIDBody = {
    uri: bitIDUri,
    signature: signedMesssage,
    address: address
  }
  const result = await fetch(bitIDCallbackUri, {
    body: bitIDBody
  })
  if (parseInt(result.status) !== 200) {
    const error = await result.text()
    throw new Error(error)
  }
  const bitIDACK = await result.json()
  return bitIDACK
}

export const biIDMakePath = (uri: string, index: number = 0) => {
  const uriBuffer = Buffer.from(uri)
  const indexBuffer = Buffer.alloc(4)
  indexBuffer.writeUInt32LE(index, 0)

  const preHashBuffer = Buffer.concat([indexBuffer, uriBuffer])
  const pathBuffer256 = hash256Sync(preHashBuffer)

  const a = pathBuffer256.readUInt32LE(0)
  const b = pathBuffer256.readUInt32LE(4)
  const c = pathBuffer256.readUInt32LE(8)
  const d = pathBuffer256.readUInt32LE(12)

  const path = `m/13’/${a}’/${b}’/${c}’/${d}’/${index}`
  return path
}
