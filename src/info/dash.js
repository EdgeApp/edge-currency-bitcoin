// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'dash',
  magic: 0xd9b4bef9,
  formats: ['bip44', 'bip32'],
  keyPrefix: {
    privkey: 0xcc,
    xpubkey: 0x02fe52cc,
    xprivkey: 0x02fe52f8,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 5
  },
  addressPrefix: {
    pubkeyhash: 0x4c,
    scripthash: 0x10
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'dash',
  currencyCode: 'DASH',
  gapLimit: 10,
  defaultFee: 10000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '300',
    lowFee: '100',
    standardFeeLow: '150',
    standardFeeHigh: '200',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000'
  },
  instantlock: true
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'DASH',
  displayName: 'Dash',
  pluginId: 'dash',
  denominations: [
    { name: 'DASH', multiplier: '100000000', symbol: 'Ð' },
    { name: 'mDASH', multiplier: '100000', symbol: 'mÐ' }
  ],
  walletType: 'wallet:dash',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrum.dash.siampm.com:50001',
      'electrum://e-1.claudioboxx.com:50005',
      'electrum://electrum.leblancnet.us:50015',
      'electrums://e-1.claudioboxx.com:50006',
      'electrums://ele.nummi.it:50008',
      'electrums://178.62.234.69:50002',
      'electrum://178.62.234.69:50001',
      'electrums://electrum.leblancnet.us:50016',
      'electrums://electrum.dash.siampm.com:50002'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/dash/block/%s?from=edgeapp',
  addressExplorer: 'https://blockchair.com/dash/address/%s?from=edgeapp',
  transactionExplorer: 'https://blockchair.com/dash/transaction/%s?from=edgeapp'
}

export const dash = { bcoinInfo, engineInfo, currencyInfo }
