// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import { type EngineCurrencyInfo } from '../../types/engine.js'

const engineInfo: $Shape<EngineCurrencyInfo> = {
  maxFee: 1000000,
  defaultFee: 10000,

  simpleFeeSettings: {
    highFee: '10',
    lowFee: '1',
    standardFeeLow: '5',
    standardFeeHigh: '9',
    standardFeeLowAmount: '10000',
    standardFeeHighAmount: '6500000000'
  }
}

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: 'TBCH',
  displayName: 'Bitcoin Cash Testnet',
  pluginName: 'bitcoincashtestnet',
  denominations: [
    { name: 'TBCH', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBCH', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],
  // Configuration options:
  defaultSettings: {
    electrumServers: [['h.1209k.com', '50001']],
    disableFetchingServers: true
  },
  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin-cash/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin-cash/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin-cash/transaction/%s'
}

export const bitcoincashTestnet = { engineInfo, currencyInfo }
