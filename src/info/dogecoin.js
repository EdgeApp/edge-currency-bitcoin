// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'dogecoin',
  magic: 0x00000000,
  keyPrefix: {
    privkey: 0x9e,
    xpubkey: 0x02facafd,
    xprivkey: 0x02fac398,
    xprivkey58: 'xprv',
    xpubkey58: 'xpub',
    coinType: 3
  },
  addressPrefix: {
    pubkeyhash: 0x1e,
    scripthash: 0x16
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'dogecoin',
  currencyCode: 'DOGE',
  gapLimit: 25,
  maxFee: 1000000,
  defaultFee: 1000,
  feeUpdateInterval: 10000,
  simpleFeeSettings: {
    highFee: '1000',
    lowFee: '100',
    standardFeeLow: '500',
    standardFeeHigh: '750',
    standardFeeLowAmount: '2000000000',
    standardFeeHighAmount: '98100000000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'DOGE',
  currencyName: 'Dogecoin',
  pluginName: 'dogecoin',
  denominations: [{ name: 'DOGE', multiplier: '100000000', symbol: 'Ð' }],
  walletTypes: ['wallet:dogecoin-bip44'],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://live.blockcypher.com/doge/address/%s',
  blockExplorer: 'https://live.blockcypher.com/doge/block/%s',
  transactionExplorer: 'https://live.blockcypher.com/doge/tx/%s',

  // Images:
  symbolImage: ''
}

export const dogecoin = { bcoinInfo, engineInfo, currencyInfo }
