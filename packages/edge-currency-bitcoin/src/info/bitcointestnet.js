// @flow

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { EdgeCurrencyInfo } from '../utils/flowTypes.js'
import { imageServerUrl } from './constants.js'

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcointestnet',
  currencyCode: 'TBTC',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  feeInfoServer: '',
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '30',
    lowFee: '5',
    standardFeeLow: '10',
    standardFeeHigh: '15',
    standardFeeLowAmount: '17320',
    standardFeeHighAmount: '86700000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'TBTC',
  currencyName: 'Bitcoin Testnet',
  pluginName: 'bitcointestnet',
  denominations: [
    { name: 'TBTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://testnet.hsmiths.com:53011',
      'electrum://testnet1.bauerj.eu:50001',
      'electrum://electrum.akinbo.org:51001',
      'electrum://electrum.akinbo.org:51001',
      'electrum://testnet1.bauerj.eu:50001',
      'electrum://testnet.qtornado.com:51001',
      'electrum://testnet.hsmiths.com:53011',
      'electrums://testnet.hsmiths.com:53012',
      'electrums://testnet.qtornado.com:51002',
      'electrums://electrum.akinbo.org:51002'
    ],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://live.blockcypher.com/btc-testnet/block/%s',
  addressExplorer: 'https://live.blockcypher.com/btc-testnet/address/%s',
  transactionExplorer: 'https://live.blockcypher.com/btc-testnet/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoin-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoin-logo-solo-64.png`
}

export const bitcoinTestnet = { engineInfo, currencyInfo }
