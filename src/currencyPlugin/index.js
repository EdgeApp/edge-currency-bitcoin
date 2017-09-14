import { parse, serialize } from 'uri-js'
import { bns } from 'biggystring'
import cs from 'coinstring'
import CurrencyEngine from './currencyEngine/index'

const BufferJS = require('bufferPlaceHolder').Buffer

const getParameterByName = (param, url) => {
  const name = param.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

export default ([txLibInfo, bcoin]) => {
  const currencyName = txLibInfo.getInfo.currencyName.toLowerCase()

  if (txLibInfo &&
    txLibInfo.getInfo &&
    txLibInfo.getInfo.defaultsSettings &&
    txLibInfo.getInfo.defaultsSettings.networkSettings) {
    const networkSettings = txLibInfo.getInfo.defaultsSettings.networkSettings
    const mainBcoinSettings = bcoin.protocol.networks.main
    const testBcoinSettings = bcoin.protocol.networks.testnet
    if (networkSettings.main) {
      if (typeof networkSettings.main.magic === 'number') {
        mainBcoinSettings.magic = networkSettings.main.magic
      }
      if (networkSettings.main.keyPrefix) {
        mainBcoinSettings.keyPrefix = networkSettings.main.keyPrefix
      }
      if (networkSettings.main.addressPrefix) {
        mainBcoinSettings.addressPrefix = networkSettings.main.addressPrefix
      }
    }
    if (networkSettings.testnet) {
      if (typeof networkSettings.testnet.magic === 'number') {
        testBcoinSettings.magic = networkSettings.testnet.magic
      }
      if (networkSettings.testnet.keyPrefix) {
        testBcoinSettings.keyPrefix = networkSettings.testnet.keyPrefix
      }
      if (networkSettings.testnet.addressPrefix) {
        testBcoinSettings.addressPrefix = networkSettings.testnet.addressPrefix
      }
    }
  }

  const magicByteMain = bcoin.protocol.networks.main.addressPrefix.pubkeyhash
  const magicByteTestnet = bcoin.protocol.networks.testnet.addressPrefix.pubkeyhash

  const valid = address => cs.createValidator(magicByteMain)(address)

  const createRandomPrivateKey = io => ({
    [`${currencyName}Key`]: BufferJS.from(io.random(32)).toString('base64')
  })

  const createPublicKey = (walletInfo, network) => {
    if (!walletInfo.keys[`${currencyName}Key`]) throw new Error('InvalidKeyName')
    const keyBuffer = BufferJS.from(walletInfo.keys[`${currencyName}Key`], 'base64')
    return {
      [`${currencyName}Key`]: walletInfo.keys[`${currencyName}Key`],
      [`${currencyName}Xpub`]: bcoin.hd.PrivateKey.fromSeed(keyBuffer, network).xpubkey()
    }
  }

  const privKeyInit = {
    [`${currencyName}`]: io => createRandomPrivateKey(io),
    [`${currencyName}44`]: io => createRandomPrivateKey(io),
    'testnet': io => createRandomPrivateKey(io),
    'testnet44': io => createRandomPrivateKey(io)
  }

  const pubKeyInit = {
    [`${currencyName}`]: walletInfo => createPublicKey(walletInfo, 'main'),
    [`${currencyName}44`]: walletInfo => createPublicKey(walletInfo, 'main'),
    'testnet': walletInfo => createPublicKey(walletInfo, 'testnet'),
    'testnet44': walletInfo => createPublicKey(walletInfo, 'testnet')
  }

  return {
    pluginType: 'currency',
    makePlugin: async (opts = {io: {}}) => {
      let io = opts.io
      return {
        pluginName: txLibInfo.getInfo.currencyName.toLowerCase(),
        currencyInfo: txLibInfo.getInfo,

        createPrivateKey: (walletType) => {
          walletType = walletType.replace('wallet:', '').toLowerCase()
          if (!privKeyInit[walletType]) throw new Error('InvalidWalletType')
          return privKeyInit[walletType](io)
        },

        derivePublicKey: (walletInfo) => {
          walletInfo.type = walletInfo.type.replace('wallet:', '').toLowerCase()
          if (!pubKeyInit[walletInfo.type]) throw new Error('InvalidWalletType')
          if (!walletInfo.keys) throw new Error('InvalidKeyName')
          return pubKeyInit[walletInfo.type](walletInfo)
        },

        makeEngine: (keyInfo, opts = {}) => {
          const network = keyInfo.type.includes('testnet') ? 'testnet' : 'main'
          const magicByte = network === 'testnet' ? magicByteTestnet : magicByteMain

          keyInfo.network = network
          keyInfo.magicByte = magicByte
          if (keyInfo.keys) {
            keyInfo.keys.currencyKey = keyInfo.keys[`${currencyName}Key`]
          }
          return CurrencyEngine(bcoin, txLibInfo).makeEngine(io, keyInfo, opts)
        },

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
}
