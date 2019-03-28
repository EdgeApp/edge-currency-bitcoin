// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import { type EngineCurrencyInfo } from '../../types/engine.js'
import { imageServerUrl } from './constants.js'

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcoinsv',
  currencyCode: 'BSV',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 10000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '20',
    lowFee: '3',
    standardFeeLow: '5',
    standardFeeHigh: '10',
    standardFeeLowAmount: '1000000',
    standardFeeHighAmount: '65000000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'BSV',
  displayName: 'Bitcoin SV',
  pluginName: 'bitcoinsv',
  denominations: [
    { name: 'BSV', multiplier: '100000000', symbol: '₿' },
    { name: 'mBSV', multiplier: '100000', symbol: 'm₿' },
    { name: 'cash', multiplier: '100', symbol: 'ƀ' }
  ],
  walletType: 'wallet:bitcoinsv',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
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
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://bsvexplorer.info/#/block/%s',
  addressExplorer: 'https://bsvexplorer.info/#/address/%s',
  transactionExplorer: 'https://bsvexplorer.info/#/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoinsv-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoinsv-logo-solo-64.png`
}

export const bitcoinsv = { engineInfo, currencyInfo }
