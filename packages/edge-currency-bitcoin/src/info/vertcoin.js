// @flow

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import { type EdgeCurrencyInfo } from 'edge-core-js/types'
import { imageServerUrl } from './constants.js'

const engineInfo: EngineCurrencyInfo = {
  network: 'vertcoin',
  currencyCode: 'VTC',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'VTC',
  currencyName: 'Vertcoin',
  pluginName: 'vertcoin',
  denominations: [
    { name: 'VTC', multiplier: '100000000', symbol: 'V' },
    { name: 'mVTC', multiplier: '100000', symbol: 'mV' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrum-alts-wusa2-az.edge.app:50001',
      'electrum://electrum-alts-weuro-az.edge.app:50001',
      'electrum://electrum-alts-ejapan-az.edge.app:50001'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://bitinfocharts.com/vertcoin/block/%s',
  addressExplorer: 'https://bitinfocharts.com/vertcoin/address/%s',
  transactionExplorer: 'https://bitinfocharts.com/vertcoin/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/vertcoin-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/vertcoin-logo-solo-64.png`
}

export const vertcoin = { engineInfo, currencyInfo }
