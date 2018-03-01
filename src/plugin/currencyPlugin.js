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
} from 'edge-login'
import {
  validAddress,
  sanitizeAddress,
  dirtyAddress
} from '../utils/addressFormat/addressFormatIndex.js'
import bcoin from 'bcoin'
import { bns } from 'biggystring'
// $FlowFixMe
import buffer from 'buffer-hack'
import { parse, serialize } from 'uri-js'
import { CurrencyEngine } from '../engine/currencyEngine.js'
import { PluginState } from './pluginState.js'

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

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyPlugin {
  currencyInfo: AbcCurrencyInfo
  network: string
  pluginName: string
  io: AbcIo
  state: PluginState

  // ------------------------------------------------------------------------
  // Private API
  // ------------------------------------------------------------------------
  constructor (options: AbcCorePluginOptions, currencyInfo: AbcCurrencyInfo) {
    // Validate that we are a valid AbcCurrencyPlugin:
    // eslint-disable-next-line no-unused-vars
    const test: AbcCurrencyPlugin = this

    // Public API:
    this.currencyInfo = currencyInfo
    this.network = this.currencyInfo.defaultSettings.network.type
    this.pluginName = this.currencyInfo.pluginName
    console.log(`Creating Currency Plugin for ${this.pluginName}`)
    // Private API:
    this.io = options.io
    this.state = new PluginState(this.io, currencyInfo)
  }

  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------
  createPrivateKey (walletType: string) {
    const randomBuffer = Buffer.from(this.io.random(32))
    const mnemonic = bcoin.hd.Mnemonic.fromEntropy(randomBuffer)
    return {
      [`${this.network}Key`]: mnemonic.getPhrase()
    }
  }

  async derivePublicKey (walletInfo: AbcWalletInfo) {
    if (!~this.currencyInfo.walletTypes.indexOf(walletInfo.type)) {
      throw new Error('InvalidWalletType')
    }
    if (!walletInfo.keys) throw new Error('InvalidKeyName')
    const walletType = walletInfo.keys[`${this.network}Key`]
    if (!walletType) throw new Error('InvalidKeyName')
    const mnemonic = bcoin.hd.Mnemonic.fromPhrase(walletType)
    // TODO: Allow fromMnemonic to be async. API needs to change -paulvp
    let privateKey
    const result = bcoin.hd.PrivateKey.fromMnemonic(mnemonic, this.network)
    if (typeof result.then === 'function') {
      privateKey = await Promise.resolve(result)
    } else {
      privateKey = result
    }
    return {
      [`${this.network}Key`]: walletInfo.keys[`${this.network}Key`],
      [`${this.network}Xpub`]: privateKey.xpubkey()
    }
  }

  async makeEngine (
    walletInfo: AbcWalletInfo,
    options: AbcCurrencyEngineOptions
  ): Promise<AbcCurrencyEngine> {
    if (!options.optionalSettings) {
      options.optionalSettings = {}
    }
    options.optionalSettings.io = this.io
    if (!options.walletLocalFolder) {
      throw new Error('Cannot create an engine without a local folder')
    }
    const engine = new CurrencyEngine(
      walletInfo,
      this.currencyInfo,
      this.state,
      options
    )
    await engine.load()
    return engine
  }

  getSplittableTypes (walletInfo: AbcWalletInfo) {
    let format = walletInfo.type.split('-')[1]
    if (!format || format === '') {
      format = walletInfo.keys && walletInfo.keys.format
    }
    const allowed = this.currencyInfo.splittableTypes.filter(type => {
      return format === '' || !format || format === 'bip32'
        ? !type.includes('bip')
        : type.includes(format)
    })
    return allowed
  }

  parseUri (uri: string): AbcParsedUri {
    const parsedUri = parse(uri)
    const currencyInfo = this.currencyInfo
    if (
      parsedUri.scheme &&
      parsedUri.scheme.toLowerCase() !== currencyInfo.currencyName.toLowerCase()
    ) {
      throw new Error('InvalidUriError')
    }

    let publicAddress = parsedUri.host || parsedUri.path
    if (!publicAddress) throw new Error('InvalidUriError')
    publicAddress = publicAddress.replace('/', '') // Remove any slashes
    publicAddress = dirtyAddress(publicAddress, this.network)
    if (!validAddress(publicAddress, this.network)) throw new Error('InvalidPublicAddressError')

    const amountStr = getParameterByName('amount', uri)
    const metadata = {}
    const name = getParameterByName('label', uri)
    const message = getParameterByName('message', uri)
    if (name) metadata.name = name
    if (message) metadata.message = message
    const abcParsedUri: AbcParsedUri = { publicAddress, metadata }

    if (amountStr && typeof amountStr === 'string') {
      const denom: any = currencyInfo.denominations.find(
        e => e.name === currencyInfo.currencyCode
      )
      const multiplier: string = denom.multiplier.toString()
      const t = bns.mul(amountStr, multiplier)
      abcParsedUri.nativeAmount = bns.toFixed(t, 0, 0)
      abcParsedUri.currencyCode = currencyInfo.currencyCode
    }
    return abcParsedUri
  }

  encodeUri (obj: AbcEncodeUri): string {
    if (!obj.publicAddress || !validAddress(obj.publicAddress, this.network)) {
      throw new Error('InvalidPublicAddressError')
    }
    if (!obj.nativeAmount && !obj.metadata) return dirtyAddress(obj.publicAddress, this.network)
    obj.publicAddress = sanitizeAddress(obj.publicAddress, this.network)
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
      if (obj.metadata.name) queryString += `label=${obj.metadata.name}&`
      if (obj.metadata.message) {
        // $FlowFixMe
        queryString += `message=${obj.metadata.message}&`
      }
    }
    queryString = queryString.substr(0, queryString.length - 1)

    return serialize({
      scheme: info.currencyName.toLowerCase(),
      path: obj.publicAddress,
      query: queryString
    })
  }
}
