import { ABCTxLibBTC } from "./modules/abcTxLibBTC.js"
import { txLibInfo } from "./txLibInfo.js"
import { parse, serialize } from 'uri-js'
import { bns } from 'biggystring'
import cs from 'coinstring'
import path from 'path'

//including Bcoin Engine
let bcoin = require("../vendor/bcoin.js")
let coininfo = require(path.join(__dirname, './txLibInfo.js'))

function getParameterByName (param, url) {
  const name = param.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

class BitcoinPlugin(opts) {
    static async makePlugin (opts = {io:{}}) {
        return {
            currencyInfo: txLibInfo.getInfo,

            createMasterKeys: function(walletType) {
                if (walletType === 'bitcoin') {
                    let master = new bcoin.masterkey()
                    mnemonic = new bcoin.mnemonic(null)
                    let key = bcoin.hd.fromMnemonic(mnemonic, null)
                    master.fromKey(key, mnemonic)
                    let hex = master.key.privateKey.toString("base64")
                    let mnemonic = master.mnemonic.phrase
                    return {
                        bitcoinKey: hex,
                        mnemonic: mnemonic
                    }
                } else {
                    return null
                }
            },

            makeEngine: function(keyInfo, opts) {
                let abcTxLib = new ABCTxLibBTC(opts.io, keyInfo, opts)
                return abcTxLib
            },
            parseUri: (uri) => {
                let parsedUri = parse(uri)

                let address = parsedUri.host || parsedUri.path
                if (!address) throw new Error('InvalidUriError')
                address = address.replace('/', '') // Remove any slashes
                if (!testAddress(address)) throw new Error('InvalidPublicAddressError')

                let nativeAmount = null
                let currencyCode = null

                if (typeof parsedUri.scheme !== 'undefined' &&
                      parsedUri.scheme !== 'bitcoin') throw new Error('InvalidUriError')

                let amountStr = getParameterByName('amount', uri)
                let testAddress = cs.createValidator(0x00)

                if (amountStr && typeof amountStr === 'string') {
                    let amount = parseFloat(amountStr)
                    let multiplier = coininfo.getInfo
                        .denominations.find(e => e === 'BTC').multiplier.toString()
                    nativeAmount = bns.mulf(amount, multiplier)
                    currencyCode = 'BTC'
                }

                return {
                    publicAddress: address
                    nativeAmount: nativeAmount
                    currencyCode: currencyCode
                    label: getParameterByName('label', uri)
                    message: getParameterByName('message', uri)
                }
            }
        }
    }
}

export { BitcoinPlugin }
