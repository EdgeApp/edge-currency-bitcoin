// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../../types/engine.js'
import { imageServerUrl } from './constants.js'

const engineInfo: EngineCurrencyInfo = {
  network: 'uniformfiscalobject',
  currencyCode: 'UFO',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 50000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '2250',
    lowFee: '1000',
    standardFeeLow: '1100',
    standardFeeHigh: '2000',
    standardFeeLowAmount: '51282051282051',
    standardFeeHighAmount: '5128205128205100'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'UFO',
  displayName: 'UFO',
  pluginName: 'ufo',
  denominations: [
    { name: 'UFO', multiplier: '100000000', symbol: 'Ʉ' },
    { name: 'kUFO', multiplier: '100000000000', symbol: 'kɄ' }
  ],
  walletType: 'wallet:ufo',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrumx1.ufobject.com:50001',
      'electrum://electrumx2.ufobject.com:50001',
      'electrum://electrumx3.ufobject.com:50001',
      'electrum://electrumx4.ufobject.com:50001',
      'electrum://electrumx5.ufobject.com:50001'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://explorer.ufobject.com/address/%s',
  blockExplorer: 'https://explorer.ufobject.com/block/%s',
  transactionExplorer: 'https://explorer.ufobject.com/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/ufo-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/ufo-logo-solo-64.png`
}

export const ufo = { engineInfo, currencyInfo }
