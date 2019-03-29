// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import { type EngineCurrencyInfo } from '../../types/engine.js'

const engineInfo: $Shape<EngineCurrencyInfo> = {
  maxFee: 1000000,
  defaultFee: 100000,

  simpleFeeSettings: {
    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000'
  }
}

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: 'GRS',
  displayName: 'Groestlcoin',
  pluginName: 'groestlcoin',
  denominations: [
    { name: 'GRS', multiplier: '100000000', symbol: 'G' },
    { name: 'mGRS', multiplier: '100000', symbol: 'mG' }
  ],
  // Configuration options:
  defaultSettings: {
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
  // Explorers:
  addressExplorer: 'http://groestlsight.groestlcoin.org/address/%s',
  blockExplorer: 'http://groestlsight.groestlcoin.org',
  transactionExplorer: 'http://groestlsight.groestlcoin.org/tx/%s'
}

export const groestlcoin = { engineInfo, currencyInfo }
