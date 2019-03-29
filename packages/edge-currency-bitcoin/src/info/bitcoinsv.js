// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'
import { type EngineCurrencyInfo } from '../../types/engine.js'

const engineInfo: $Shape<EngineCurrencyInfo> = {
  maxFee: 1000000,
  defaultFee: 10000,

  simpleFeeSettings: {
    highFee: '20',
    lowFee: '3',
    standardFeeLow: '5',
    standardFeeHigh: '10',
    standardFeeLowAmount: '1000000',
    standardFeeHighAmount: '65000000'
  }
}

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: 'BSV',
  displayName: 'Bitcoin SV',
  pluginName: 'bitcoinsv',
  denominations: [
    { name: 'BSV', multiplier: '100000000', symbol: '₿' },
    { name: 'mBSV', multiplier: '100000', symbol: 'm₿' },
    { name: 'cash', multiplier: '100', symbol: 'ƀ' }
  ],
  // Configuration options:
  defaultSettings: {
    electrumServers: [
      'electrum://bch.electrumx.cash:50001',
      'electrums://bch.electrumx.cash:50002',
      'electrums://satoshi.vision.cash:50002',
      'electrum://sv1.hsmiths.com:60003',
      'electrums://sv1.hsmiths.com:60004',
      'electrum://electrumx-sv.1209k.com:50001',
      'electrums://electrumx-sv.1209k.com:50002',
      'electrum://electroncash.cascharia.com:50001',
      'electrums://electroncash.cascharia.com:50002'
    ]
  },
  // Explorers:
  blockExplorer: 'https://bsvexplorer.info/#/block/%s',
  addressExplorer: 'https://bsvexplorer.info/#/address/%s',
  transactionExplorer: 'https://bsvexplorer.info/#/tx/%s'
}

export const bitcoinsv = { engineInfo, currencyInfo }
