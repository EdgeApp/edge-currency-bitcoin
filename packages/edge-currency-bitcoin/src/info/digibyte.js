// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import { type EngineCurrencyInfo } from '../../types/engine.js'
import { imageServerUrl } from './constants.js'

const engineInfo: EngineCurrencyInfo = {
  network: 'digibyte',
  currencyCode: 'DGB',
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
  currencyCode: 'DGB',
  displayName: 'DigiByte',
  pluginName: 'digibyte',
  denominations: [
    { name: 'DGB', multiplier: '100000000', symbol: 'Ɗ' },
    { name: 'mDGB', multiplier: '100000', symbol: 'mƊ' }
  ],
  walletType: 'wallet:digibyte',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrum-alts-wusa2-az.edge.app:50021',
      'electrum://electrum-alts-weuro-az.edge.app:50021',
      'electrum://electrum-alts-ejapan-az.edge.app:50021'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://digiexplorer.info/block/%s',
  addressExplorer: 'https://digiexplorer.info/address/%s',
  transactionExplorer: 'https://digiexplorer.info/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/digibyte-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/digibyte-logo-solo-64.png`
}

export const digibyte = { engineInfo, currencyInfo }
