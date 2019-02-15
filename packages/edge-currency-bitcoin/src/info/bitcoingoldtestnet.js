// @flow

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { EdgeCurrencyInfo } from '../utils/flowTypes.js'
import { imageServerUrl } from './constants.js'

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcoingold',
  currencyCode: 'TBTG',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  feeInfoServer: '',
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '200',
    lowFee: '10',
    standardFeeLow: '15',
    standardFeeHigh: '140',
    standardFeeLowAmount: '17320',
    standardFeeHighAmount: '86700000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'TBTG',
  currencyName: 'Bitcoin Gold Testnet',
  pluginName: 'bitcoingoldtestnet',
  denominations: [
    { name: 'TBTG', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBTG', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
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
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://test-explorer.bitcoingold.org/insight/block/%s',
  addressExplorer: 'https://test-explorer.bitcoingold.org/insight/address/%s',
  transactionExplorer: 'https://test-explorer.bitcoingold.org/insight/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoingold-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoingold-logo-solo-64.png`
}

export const bitcoingoldTestnet = { engineInfo, currencyInfo }
