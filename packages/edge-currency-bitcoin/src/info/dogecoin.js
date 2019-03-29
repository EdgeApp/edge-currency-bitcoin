// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'
import { type EngineCurrencyInfo } from '../../types/engine.js'

const engineInfo: $Shape<EngineCurrencyInfo> = {
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

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: 'DOGE',
  displayName: 'Dogecoin',
  pluginName: 'dogecoin',
  denominations: [{ name: 'DOGE', multiplier: '100000000', symbol: 'Ð' }],
  // Configuration options:
  defaultSettings: {
    electrumServers: [
      'electrum://electrum-alts-wusa2-az.edge.app:50011',
      'electrum://electrum-alts-weuro-az.edge.app:50011',
      'electrum://electrum-alts-ejapan-az.edge.app:50011'
    ]
  },
  // Explorers:
  addressExplorer: 'https://live.blockcypher.com/doge/address/%s',
  blockExplorer: 'https://live.blockcypher.com/doge/block/%s',
  transactionExplorer: 'https://live.blockcypher.com/doge/tx/%s'
}

export const dogecoin = { engineInfo, currencyInfo }
