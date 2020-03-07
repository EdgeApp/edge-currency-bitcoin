// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import { type EngineCurrencyInfo } from '../../types/engine.js'

const engineInfo: $Shape<EngineCurrencyInfo> = {
  network: 'bitcoingold',
  maxFee: 1000000,
  defaultFee: 1000,
  simpleFeeSettings: {
    highFee: '200',
    lowFee: '10',
    standardFeeLow: '15',
    standardFeeHigh: '140',
    standardFeeLowAmount: '17320',
    standardFeeHighAmount: '86700000'
  }
}

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: 'TBTG',
  displayName: 'Bitcoin Gold Testnet',
  pluginName: 'bitcoingoldtestnet',
  denominations: [
    { name: 'TBTG', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBTG', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],
  // Configuration options:
  defaultSettings: {
    electrumServers: [
      'electrum://test-node1.bitcoingold.org:50001',
      'electrums://test-node1.bitcoingold.org:50002',
      'electrum://test-node2.bitcoingold.org :50001',
      'electrums://test-node2.bitcoingold.org :50002',
      'electrum://test-node3.bitcoingold.org:50001',
      'electrums://test-node3.bitcoingold.org:50002',
      'electrum://test-node1.btcgpu.org:50001',
      'electrums://test-node1.btcgpu.org:50002',
      'electrum://test-node2.btcgpu.org:50001',
      'electrums://test-node2.btcgpu.org:50002',
      'electrum://test-node3.btcgpu.org:50001',
      'electrums://test-node3.btcgpu.org:50002'
    ],
    disableFetchingServers: true
  },
  // Explorers:
  blockExplorer: 'https://test-explorer.bitcoingold.org/insight/block/%s',
  addressExplorer: 'https://test-explorer.bitcoingold.org/insight/address/%s',
  transactionExplorer: 'https://test-explorer.bitcoingold.org/insight/tx/%s'
}

export const bitcoingoldTestnet = { engineInfo, currencyInfo }
