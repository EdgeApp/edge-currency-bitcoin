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
  currencyCode: 'XZC',
  displayName: 'Zcoin',
  pluginName: 'zcoin',
  denominations: [
    { name: 'XZC', multiplier: '100000000', symbol: 'Ƶ' },
    { name: 'mXZC', multiplier: '100000', symbol: 'mƵ' }
  ],
  // Configuration options:
  defaultSettings: {
    electrumServers: [
      'electrum://51.15.82.184:50001',
      'electrum://45.63.92.224:50001',
      'electrum://47.75.76.176:50001',
      'electrums://51.15.82.184:50002',
      'electrums://45.63.92.224:50002',
      'electrums://47.75.76.176:50002'
    ]
  },
  // Explorers:
  addressExplorer: 'https://insight.zcoin.io/address/%s',
  blockExplorer: 'https://insight.zcoin.io/block/%s',
  transactionExplorer: 'https://insight.zcoin.io/tx/%s'
}

export const zcoin = { engineInfo, currencyInfo }
