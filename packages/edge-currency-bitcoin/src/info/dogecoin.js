// @flow

import type { EngineCurrencyInfo } from '../../types/engine.js'
import { type EdgeCurrencyInfo } from 'edge-core-js/types'
import { imageServerUrl } from './constants.js'

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
  displayName: 'Dogecoin',
  pluginName: 'dogecoin',
  denominations: [{ name: 'DOGE', multiplier: '100000000', symbol: 'Ð' }],
  walletType: 'wallet:dogecoin',

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

export const dogecoin = { engineInfo, currencyInfo }
