// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'
import { type EngineCurrencyInfo } from '../../types/engine.js'

const engineInfo: $Shape<EngineCurrencyInfo> = {
  maxFee: 1000000,
  defaultFee: 1000,
  simpleFeeSettings: {
    highFee: '1000',
    lowFee: '400',
    standardFeeLow: '450',
    standardFeeHigh: '700',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000'
  }
}

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: 'QTUM',
  displayName: 'Qtum',
  pluginName: 'qtum',
  denominations: [{ name: 'QTUM', multiplier: '100000000', symbol: 'Q' }],
  // Configuration options:
  defaultSettings: {
    electrumServers: [
      'electrum://s1.qtum.info:50001',
      'electrum://s2.qtum.info:50001',
      'electrum://s3.qtum.info:50001',
      'electrum://s4.qtum.info:50001',
      'electrum://s5.qtum.info:50001',
      'electrum://s6.qtum.info:50001',
      'electrum://s7.qtum.info:50001',
      'electrum://s8.qtum.info:50001',
      'electrum://s9.qtum.info:50001'
    ]
  },
  // Explorers:
  blockExplorer: 'https://explorer.qtum.org/block/%s',
  addressExplorer: 'https://explorer.qtum.org/address/%s',
  transactionExplorer: 'https://explorer.qtum.org/tx/%s'
}

export const qtum = { engineInfo, currencyInfo }
