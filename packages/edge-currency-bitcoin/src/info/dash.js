// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import { type EngineCurrencyInfo } from '../../types/engine.js'

const engineInfo: $Shape<EngineCurrencyInfo> = {
  maxFee: 100000,
  defaultFee: 10000,

  simpleFeeSettings: {
    highFee: '300',
    lowFee: '100',
    standardFeeLow: '150',
    standardFeeHigh: '200',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000'
  }
}

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: 'DASH',
  displayName: 'Dash',
  pluginName: 'dash',
  denominations: [
    { name: 'DASH', multiplier: '100000000', symbol: 'Ð' },
    { name: 'mDASH', multiplier: '100000', symbol: 'mÐ' }
  ],
  // Configuration options:
  defaultSettings: {
    electrumServers: [
      'electrum://electrum.dash.siampm.com:50001',
      'electrum://e-1.claudioboxx.com:50005',
      'electrum://electrum.leblancnet.us:50015',
      'electrums://e-1.claudioboxx.com:50006',
      'electrums://ele.nummi.it:50008',
      'electrums://178.62.234.69:50002',
      'electrum://178.62.234.69:50001',
      'electrums://electrum.leblancnet.us:50016',
      'electrums://electrum.dash.siampm.com:50002'
    ]
  },
  // Explorers:
  blockExplorer: 'https://blockchair.com/dash/block/%s',
  addressExplorer: 'https://blockchair.com/dash/address/%s',
  transactionExplorer: 'https://blockchair.com/dash/transaction/%s'
}

export const dash = { engineInfo, currencyInfo }
