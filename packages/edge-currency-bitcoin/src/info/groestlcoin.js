// @flow

import type { EngineCurrencyInfo } from '../../types/engine.js'
import { type EdgeCurrencyInfo } from 'edge-core-js/types'
import { imageServerUrl } from './constants.js'

const engineInfo: EngineCurrencyInfo = {
  network: 'groestlcoin',
  currencyCode: 'GRS',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 100000,
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
  currencyCode: 'GRS',
  displayName: 'Groestlcoin',
  pluginName: 'groestlcoin',
  denominations: [
    { name: 'GRS', multiplier: '100000000', symbol: 'G' },
    { name: 'mGRS', multiplier: '100000', symbol: 'mG' }
  ],
  walletType: 'wallet:groestlcoin',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrum32.groestlcoin.org:50001',
      'electrum://electrum16.groestlcoin.org:50001',
      'electrum://electrum29.groestlcoin.org:50001',
      'electrum://electrum14.groestlcoin.org:50001',
      'electrum://electrum3.groestlcoin.org:50001',
      'electrum://electrum24.groestlcoin.org:50001',
      'electrum://electrum12.groestlcoin.org:50001',
      'electrum://electrum40.groestlcoin.org:50001',
      'electrums://electrum4.groestlcoin.org:50002',
      'electrums://electrum33.groestlcoin.org:50002',
      'electrums://electrum39.groestlcoin.org:50002',
      'electrums://electrum36.groestlcoin.org:50002',
      'electrums://electrum20.groestlcoin.org:50002',
      'electrums://electrum7.groestlcoin.org:50002',
      'electrums://electrum19.groestlcoin.org:50002'
    ],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'http://groestlsight.groestlcoin.org/address/%s',
  blockExplorer: 'http://groestlsight.groestlcoin.org',
  transactionExplorer: 'http://groestlsight.groestlcoin.org/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/groestlcoin-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/groestlcoin-logo-solo-64.png`
}

export const groestlcoin = { engineInfo, currencyInfo }
