// @flow

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import { type EdgeCurrencyInfo } from 'edge-core-js/types'
import { imageServerUrl } from './constants.js'

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcoingold',
  currencyCode: 'BTG',
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

  currencyCode: 'BTG',
  currencyName: 'Bitcoin Gold',
  pluginName: 'bitcoingold',
  denominations: [
    { name: 'BTG', multiplier: '100000000', symbol: '₿' },
    { name: 'mBTG', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrumx-eu.bitcoingold.org:50001',
      'electrums://electrumx-eu.bitcoingold.org:50002',
      'electrum://electrumx-us.bitcoingold.org:50001',
      'electrums://electrumx-us.bitcoingold.org:50002',
      'electrum://electrumx-eu.btcgpu.org:50001',
      'electrums://electrumx-eu.btcgpu.org:50002',
      'electrum://electrumx-us.btcgpu.org:50001',
      'electrums://electrumx-us.btcgpu.org:50002'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://explorer.bitcoingold.org/insight/block/%s',
  addressExplorer: 'https://explorer.bitcoingold.org/insight/address/%s',
  transactionExplorer: 'https://explorer.bitcoingold.org/insight/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoingold-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoingold-logo-solo-64.png`
}

export const bitcoingold = { engineInfo, currencyInfo }
