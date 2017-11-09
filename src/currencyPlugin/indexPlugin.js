// @flow

import type {
  AbcCurrencyPlugin,
  AbcParsedUri,
  AbcEncodeUri,
  AbcCurrencyEngine,
  AbcWalletInfo,
  AbcMakeEngineOptions
} from 'airbitz-core-types'

import { parse, serialize } from 'uri-js'
import { bns } from 'biggystring'
import CurrencyEngine from '../currencyEngine/indexEngine'
import Bcoin from './bcoin'

// $FlowFixMe
const BufferJS = require('bufferPlaceHolder').Buffer

const getParameterByName = (param: string, url: string) => {
  const name = param.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

export default (txLibInfo: any) => {
  const currencyName = txLibInfo.getInfo.currencyName.toLowerCase()
  const bcoin = Bcoin(txLibInfo)

  const valid = address => {
    try {
      bcoin.primitives.Address.fromBase58(address)
      return true
    } catch (e) {
      try {
        bcoin.primitives.Address.fromBech32(address)
        return true
      } catch (e) {
        return false
      }
    }
  }

  const createRandomPrivateKey = (io: any) => {
    const randomBuffer = BufferJS.from(io.random(32))
    const mnemonic = bcoin.hd.Mnemonic.fromEntropy(randomBuffer)
    return {
      [`${currencyName}Key`]: mnemonic.getPhrase()
    }
  }

  const createPublicKey = (walletInfo: AbcWalletInfo, network: string) => {
    if (!walletInfo.keys[`${currencyName}Key`]) throw new Error('InvalidKeyName')
    const mnemonic = bcoin.hd.Mnemonic.fromPhrase(walletInfo.keys[`${currencyName}Key`])
    const privKey = bcoin.hd.PrivateKey.fromMnemonic(mnemonic, network)
    return {
      [`${currencyName}Key`]: walletInfo.keys[`${currencyName}Key`],
      [`${currencyName}Xpub`]: privKey.xpubkey()
    }
  }

  const privKeyInit = {
    [`${currencyName}`]: (io: any) => createRandomPrivateKey(io),
    [`${currencyName}44`]: (io: any) => createRandomPrivateKey(io),
    [`${currencyName}44segwit`]: (io: any) => createRandomPrivateKey(io),
    'testnet': io => createRandomPrivateKey(io),
    'testnet44': io => createRandomPrivateKey(io),
    'testnet44segwit': io => createRandomPrivateKey(io)
  }

  const pubKeyInit = {
    [`${currencyName}`]: (walletInfo: AbcWalletInfo) => createPublicKey(walletInfo, 'main'),
    [`${currencyName}44`]: (walletInfo: AbcWalletInfo) => createPublicKey(walletInfo, 'main'),
    [`${currencyName}44segwit`]: (walletInfo: AbcWalletInfo) => createPublicKey(walletInfo, 'main'),
    'testnet': walletInfo => createPublicKey(walletInfo, 'testnet'),
    'testnet44': walletInfo => createPublicKey(walletInfo, 'testnet'),
    'testnet44segwit': walletInfo => createPublicKey(walletInfo, 'testnet')
  }

  return {
    pluginType: 'currency',
    makePlugin: async (opts: any = {io: {}}): Promise<AbcCurrencyPlugin> => {
      let io = opts.io
      return {
        pluginName: txLibInfo.getInfo.currencyName.toLowerCase(),
        currencyInfo: txLibInfo.getInfo,

        createPrivateKey: (walletType: string) => {
          walletType = walletType.replace('wallet:', '').toLowerCase()
          if (!privKeyInit[walletType]) throw new Error('InvalidWalletType')
          return privKeyInit[walletType](io)
        },

        derivePublicKey: (walletInfo: AbcWalletInfo) => {
          walletInfo.type = walletInfo.type.replace('wallet:', '').toLowerCase()
          if (!pubKeyInit[walletInfo.type]) throw new Error('InvalidWalletType')
          if (!walletInfo.keys) throw new Error('InvalidKeyName')
          return pubKeyInit[walletInfo.type](walletInfo)
        },

        makeEngine: (keyInfo: any, opts: AbcMakeEngineOptions): Promise<AbcCurrencyEngine> => CurrencyEngine(bcoin, txLibInfo).makeEngine(io, keyInfo, opts),

        parseUri: (uri: string): AbcParsedUri => {
          let parsedUri = parse(uri)
          let info = txLibInfo.getInfo
          if (parsedUri.scheme &&
              parsedUri.scheme.toLowerCase() !== info.currencyName.toLowerCase()) throw new Error('InvalidUriError')

          let address = parsedUri.host || parsedUri.path
          if (!address) throw new Error('InvalidUriError')
          address = address.replace('/', '') // Remove any slashes
          if (!valid(address)) throw new Error('InvalidPublicAddressError')

          const amountStr = getParameterByName('amount', uri)

          const abcParsedUri: AbcParsedUri = {
            publicAddress: address,
            metadata: {
              label: getParameterByName('label', uri),
              message: getParameterByName('message', uri)
            }
          }

          if (amountStr && typeof amountStr === 'string') {
            let amount = parseFloat(amountStr)
            let multiplier = txLibInfo.getInfo.denominations.find(e => e.name === info.currencyCode).multiplier.toString()
            const t = bns.mul(amount, multiplier)
            abcParsedUri.nativeAmount = bns.toFixed(t, 0, 0)
            abcParsedUri.currencyCode = info.currencyCode
          }
          return abcParsedUri
        },

        encodeUri: (obj: AbcEncodeUri) => {
          if (!obj.publicAddress || !valid(obj.publicAddress)) throw new Error('InvalidPublicAddressError')
          if (!obj.nativeAmount && !obj.metadata) return obj.publicAddress
          let queryString = ''
          let info = txLibInfo.getInfo
          if (obj.nativeAmount) {
            let currencyCode = obj.currencyCode || info.currencyCode
            let multiplier = txLibInfo.getInfo.denominations.find(e => e.name === currencyCode).multiplier.toString()
            // $FlowFixMe
            let amount = bns.div(obj.nativeAmount, multiplier, 8)
            queryString += 'amount=' + amount.toString() + '&'
          }
          if (obj.metadata) {
            // $FlowFixMe
            if (obj.metadata.label) queryString += `label=${obj.metadata.label}&`
            // $FlowFixMe
            if (obj.metadata.message) queryString += `message=${obj.metadata.message}&`
          }
          queryString = queryString.substr(0, queryString.length - 1)

          return serialize({
            scheme: info.currencyName.toLowerCase(),
            path: obj.publicAddress,
            query: queryString
          })
        }
      }
    }
  }
}
