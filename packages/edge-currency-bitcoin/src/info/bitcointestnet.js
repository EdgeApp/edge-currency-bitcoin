// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import { type EngineCurrencyInfo } from '../../types/engine.js'

const engineInfo: $Shape<EngineCurrencyInfo> = {
  maxFee: 1000000,
  defaultFee: 1000,
  simpleFeeSettings: {
    highFee: '30',
    lowFee: '5',
    standardFeeLow: '10',
    standardFeeHigh: '15',
    standardFeeLowAmount: '17320',
    standardFeeHighAmount: '86700000'
  }
}

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: 'TBTC',
  displayName: 'Bitcoin Testnet',
  pluginName: 'bitcointestnet',
  denominations: [
    { name: 'TBTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' },
    { name: 'sats', multiplier: '1', symbol: 's' }
  ],
  // Configuration options:
  defaultSettings: {
    electrumServers: ['electrum://testnet.qtornado.com:51001','electrum://tn.not.fyi:55001'],
    disableFetchingServers: true
  },
  // Explorers:
  blockExplorer: 'https://live.blockcypher.com/btc-testnet/block/%s',
  addressExplorer: 'https://live.blockcypher.com/btc-testnet/address/%s',
  transactionExplorer: 'https://live.blockcypher.com/btc-testnet/tx/%s'
}

export const bitcoinTestnet = { engineInfo, currencyInfo }
