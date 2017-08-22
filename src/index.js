import { parse, serialize } from 'uri-js'
import { bns } from 'biggystring'
import cs from 'coinstring'
import { BitcoinEngine } from './currencyEngineBTC'
import { txLibInfo } from './currencyInfoBTC'

// including Bcoin Engine
const bcoin = process.env.ENV === 'NODEJS' ? require('bcoin') : require('../vendor/bcoin.js')
const Buffer = process.env.ENV === 'NODEJS' ? require('buffer').Buffer : require('buffer/').Buffer

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

let privateKeyInitializers = {
  'wallet:bitcoin': (io) => ({
    bitcoinKey: Buffer.from(io.random(32)).toString('base64')
  })
}

let publicKeyInitializers = {
  'wallet:bitcoin': (walletInfo) => {
    if (!walletInfo.keys.bitcoinKey) throw new Error('InvalidKeyName')
    return {
      bitcoinKey: walletInfo.keys.bitcoinKey,
      bitcoinXpub: bcoin.hd.PrivateKey.fromSeed(Buffer.from(walletInfo.keys.bitcoinKey, 'base64')).xpubkey()
    }
  }
}

export class BitcoinPlugin {
  static async makePlugin (opts = {io: {}}) {
    let io = opts.io
    return {
      pluginName: txLibInfo.getInfo.currencyName.toLowerCase(),
      currencyInfo: txLibInfo.getInfo,

      createPrivateKey: (walletType) => {
        if (!privateKeyInitializers[walletType]) throw new Error('InvalidWalletType')
        return privateKeyInitializers[walletType](io)
      },

      derivePublicKey: (walletInfo) => {
        if (!publicKeyInitializers[walletInfo.type]) throw new Error('InvalidWalletType')
        if (!walletInfo.keys) throw new Error('InvalidKeyName')
        return publicKeyInitializers[walletInfo.type](walletInfo)
      },

      // XXX Deprecated. To be removed once Core supports createPrivateKey and derivePublicKey -paulvp
      createMasterKeys: function (walletType) {
        if (walletType.replace('wallet:', '').toLowerCase() === txLibInfo.getInfo.currencyName.toLowerCase()) {
          let master = new bcoin.masterkey() // eslint-disable-line new-cap
          let mnemonic = new bcoin.mnemonic(null) // eslint-disable-line new-cap
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

      makeEngine: (keyInfo, opts = {}) => new BitcoinEngine(io, keyInfo, opts),

      parseUri: (uri) => {
        let parsedUri = parse(uri)
        let info = txLibInfo.getInfo
        if (parsedUri.scheme &&
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
        if (!obj.nativeAmount && !obj.label && !obj.message) return obj.publicAddress
        let queryString = ''
        let info = txLibInfo.getInfo
        if (obj.nativeAmount) {
          let currencyCode = obj.currencyCode || info.currencyCode
          let multiplier = txLibInfo.getInfo.denominations.find(e => e.name === currencyCode).multiplier.toString()
          let amount = bns.divf(obj.nativeAmount, multiplier)
          queryString += 'amount=' + amount.toString() + '&'
        }
        if (obj.label) queryString += 'label=' + obj.label + '&'
        if (obj.message) queryString += 'message=' + obj.message + '&'
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
