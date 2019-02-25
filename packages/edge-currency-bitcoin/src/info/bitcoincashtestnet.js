// @flow

import type { EngineCurrencyInfo } from '../../types/engine.js'
import { type EdgeCurrencyInfo } from 'edge-core-js/types'
import { imageServerUrl } from './constants.js'

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcoincashtestnet',
  currencyCode: 'TBCH',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 10000,
  feeUpdateInterval: 60000,
  feeInfoServer: '',
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '10',
    lowFee: '1',
    standardFeeLow: '5',
    standardFeeHigh: '9',
    standardFeeLowAmount: '10000',
    standardFeeHighAmount: '6500000000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'TBCH',
  displayName: 'Bitcoin Cash Testnet',
  pluginName: 'bitcoincashtestnet',
  denominations: [
    { name: 'TBCH', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBCH', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],
  walletType: 'wallet:bitcoincash-testnet',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [['h.1209k.com', '50001']],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin-cash/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin-cash/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin-cash/transaction/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoincash-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoincash-logo-solo-64.png`
}

export const bitcoincashTestnet = { engineInfo, currencyInfo }
