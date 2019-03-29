// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'
import { type EngineCurrencyInfo } from '../../types/engine.js'

const engineInfo: $Shape<EngineCurrencyInfo> = {
  maxFee: 1000000,
  defaultFee: 1000,
  simpleFeeSettings: {
    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000'
  }
}

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: 'VTC',
  displayName: 'Vertcoin',
  pluginName: 'vertcoin',
  denominations: [
    { name: 'VTC', multiplier: '100000000', symbol: 'V' },
    { name: 'mVTC', multiplier: '100000', symbol: 'mV' }
  ],
  // Configuration options:
  defaultSettings: {
    electrumServers: [
      'electrum://electrum-alts-wusa2-az.edge.app:50001',
      'electrum://electrum-alts-weuro-az.edge.app:50001',
      'electrum://electrum-alts-ejapan-az.edge.app:50001'
    ]
  },
  // Explorers:
  blockExplorer: 'https://bitinfocharts.com/vertcoin/block/%s',
  addressExplorer: 'https://bitinfocharts.com/vertcoin/address/%s',
  transactionExplorer: 'https://bitinfocharts.com/vertcoin/tx/%s'
}

export const vertcoin = { engineInfo, currencyInfo }
