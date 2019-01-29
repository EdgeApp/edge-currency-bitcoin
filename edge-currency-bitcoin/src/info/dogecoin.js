// @flow
import type { EdgeCurrencyInfo } from '../utils/flowTypes.js'
import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { NetworkInfo } from '../utils/bcoinUtils/types.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: NetworkInfo = {
  type: 'dogecoin',
  magic: 0x00000000,
  supportedBips: [44, 32],
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
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 1000,
  feeUpdateInterval: 10000,
  customFeeSettings: ['satPerByte'],
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

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrum-alts-wusa2-az.edge.app:50011',
      'electrum://electrum-alts-weuro-az.edge.app:50011',
      'electrum://electrum-alts-ejapan-az.edge.app:50011'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://live.blockcypher.com/doge/address/%s',
  blockExplorer: 'https://live.blockcypher.com/doge/block/%s',
  transactionExplorer: 'https://live.blockcypher.com/doge/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/dogecoin-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/dogecoin-logo-solo-64.png`
}

export const dogecoin = { bcoinInfo, engineInfo, currencyInfo }
