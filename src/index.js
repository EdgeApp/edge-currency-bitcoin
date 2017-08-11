import { parse, serialize } from 'uri-js'
import { bns } from 'biggystring'
import cs from 'coinstring'
import { ABCTxLibBTC } from './modules/abcTxLibBTC.js'
import { txLibInfo } from './txLibInfo.js'

// including Bcoin Engine
let bcoin = process.env.ENV === 'NODEJS' ? require('bcoin') : require('../vendor/bcoin.js')

function getParameterByName (param, url) {
  const name = param.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

function valid (address) {
  let testAddress = cs.createValidator(0x00)
  return testAddress(address)
}

class BitcoinPlugin {
  static async makePlugin (opts = {io: {}}) {
    let io = opts.io
    return {
      currencyInfo: txLibInfo.getInfo,

      createMasterKeys: function (walletType) {
        if (walletType === txLibInfo.getInfo.currencyName) {
          let master = new bcoin.masterkey()
          let mnemonic = new bcoin.mnemonic(null)
          let key = bcoin.hd.fromMnemonic(mnemonic, null)
          master.fromKey(key, mnemonic)
          let hex = master.key.privateKey.toString('base64')
          mnemonic = master.mnemonic.phrase
          return {
            bitcoinKey: hex,
            mnemonic: mnemonic
          }
        } else {
          return null
        }
      },

      makeEngine: function (keyInfo, opts = {}) {
        let abcTxLib = new ABCTxLibBTC(io, keyInfo, opts)
        return abcTxLib
      },
      parseUri: (uri) => {
        let parsedUri = parse(uri)
        let info = txLibInfo.getInfo
        if (typeof parsedUri.scheme !== 'undefined' &&
            parsedUri.scheme.toLowerCase() !== info.currencyName.toLowerCase()) throw new Error('InvalidUriError')

        let address = parsedUri.host || parsedUri.path
        if (!address) throw new Error('InvalidUriError')
        address = address.replace('/', '') // Remove any slashes
        if (!valid(address)) throw new Error('InvalidPublicAddressError')

        let nativeAmount = null
        let currencyCode = null

        let amountStr = getParameterByName('amount', uri)

        if (amountStr && typeof amountStr === 'string') {
          let amount = parseFloat(amountStr)
          let multiplier = txLibInfo.getInfo.denominations.find(e => e.name === info.currencyCode).multiplier.toString()
          nativeAmount = bns.mulf(amount, multiplier)
          currencyCode = info.currencyCode
        }

        return {
          publicAddress: address,
          nativeAmount,
          currencyCode,
          label: getParameterByName('label', uri),
          message: getParameterByName('message', uri)
        }
      },
      encodeUri: (obj) => {
        if (!obj.publicAddress || !valid(obj.publicAddress)) throw new Error('InvalidPublicAddressError')
        if (!obj.nativeAmount && !obj.label && !obj.message) {
          return obj.publicAddress
        } else {
          let queryString = ''
          let info = txLibInfo.getInfo
          if (obj.nativeAmount) {
            let currencyCode = obj.currencyCode || info.currencyCode
            let multiplier = txLibInfo.getInfo.denominations.find(e => e.name === currencyCode).multiplier.toString()
            if (typeof multiplier !== 'string') {
              multiplier = multiplier.toString()
            }
            let amount = bns.divf(obj.nativeAmount, multiplier)

            queryString += 'amount=' + amount.toString() + '&'
          }
          if (obj.label) {
            queryString += 'label=' + obj.label + '&'
          }
          if (obj.message) {
            queryString += 'message=' + obj.message + '&'
          }
          queryString = queryString.substr(0, queryString.length - 1)

          const serializeObj = {
            scheme: info.currencyName.toLowerCase(),
            path: obj.publicAddress,
            query: queryString
          }
          const url = serialize(serializeObj)
          return url
        }
      }
    }
  }
}

export { BitcoinPlugin }
