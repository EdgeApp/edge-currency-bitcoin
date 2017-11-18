// @flow
import type {
  AbcCorePluginOptions,
  AbcCurrencyEngine,
  AbcCurrencyEngineOptions,
  AbcCurrencyInfo,
  AbcCurrencyPlugin,
  AbcEncodeUri,
  AbcIo,
  AbcParsedUri,
  AbcWalletInfo
} from 'airbitz-core-types'

// $FlowFixMe
import buffer from 'buffer-hack'
import { CurrencyEngine } from '../engine/engine-api.js'
import { EngineState } from '../engine/engine-state.js'
import { PluginState } from './plugin-state.js'
import { parse, serialize } from 'uri-js'
import { bns } from 'biggystring'
import bcoin from 'bcoin'

// $FlowFixMe
const { Buffer } = buffer

const getParameterByName = (param: string, url: string) => {
  const name = param.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

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

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyPlugin {
  currencyInfo: AbcCurrencyInfo
  pluginName: string
  io: AbcIo
  state: PluginState

  createPrivateKey (walletType: string) {
    const randomBuffer = Buffer.from(this.io.random(32))
    const mnemonic = bcoin.hd.Mnemonic.fromEntropy(randomBuffer)
    return {
      [`${this.pluginName}Key`]: mnemonic.getPhrase()
    }
  }

  derivePublicKey (walletInfo: AbcWalletInfo) {
    if (!~this.currencyInfo.walletTypes.indexOf(walletInfo.type)) throw new Error('InvalidWalletType')
    if (!walletInfo.keys) throw new Error('InvalidKeyName')
    if (!walletInfo.keys[`${this.pluginName}Key`]) throw new Error('InvalidKeyName')
    const mnemonic = bcoin.hd.Mnemonic.fromPhrase(walletInfo.keys[`${this.pluginName}Key`])
    const privKey = bcoin.hd.PrivateKey.fromMnemonic(mnemonic, this.pluginName)
    return {
      [`${this.pluginName}Key`]: walletInfo.keys[`${this.pluginName}Key`],
      [`${this.pluginName}Xpub`]: privKey.xpubkey()
    }
  }

  async makeEngine (
    walletInfo: AbcWalletInfo,
    options: AbcCurrencyEngineOptions
  ): Promise<AbcCurrencyEngine> {
    const { io } = this

    const engineState = new EngineState({
      callbacks: {},
      bcoin: {}, // TODO: Implement this
      io,
      localFolder: options.walletLocalFolder
    })
    // await engineState.load()

    return new CurrencyEngine(walletInfo, options, this.state, engineState)
  }

  parseUri (uri: string): AbcParsedUri {
    const parsedUri = parse(uri)
    const currencyInfo = this.currencyInfo
    if (parsedUri.scheme &&
        parsedUri.scheme.toLowerCase() !== currencyInfo.currencyName.toLowerCase()) throw new Error('InvalidUriError')

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
      const denom: any = currencyInfo.denominations.find(e => e.name === currencyInfo.currencyCode)
      const multiplier: string = denom.multiplier.toString()
      const t = bns.mul(amountStr, multiplier)
      abcParsedUri.nativeAmount = bns.toFixed(t, 0, 0)
      abcParsedUri.currencyCode = currencyInfo.currencyCode
    }
    return abcParsedUri
  }

  encodeUri (obj: AbcEncodeUri): string {
    if (!obj.publicAddress || !valid(obj.publicAddress)) throw new Error('InvalidPublicAddressError')
    if (!obj.nativeAmount && !obj.metadata) return obj.publicAddress
    let queryString = ''
    const info = this.currencyInfo
    if (obj.nativeAmount) {
      const currencyCode = obj.currencyCode || info.currencyCode
      const denom: any = info.denominations.find(e => e.name === currencyCode)
      const multiplier: string = denom.multiplier.toString()
      // $FlowFixMe
      const amount = bns.div(obj.nativeAmount, multiplier, 8)
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

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------
  constructor (options: AbcCorePluginOptions, currencyInfo: AbcCurrencyInfo) {
    // Validate that we are a valid AbcCurrencyPlugin:
    // eslint-disable-next-line no-unused-vars
    const test: AbcCurrencyPlugin = this

    // Public API:
    this.currencyInfo = currencyInfo

    this.pluginName = currencyInfo.currencyName.toLowerCase()

    // Private stuff:
    this.io = options.io
    this.state = new PluginState()
  }

  valid (address: string) {
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
}
