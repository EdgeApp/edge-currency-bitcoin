// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'bitcoinsv',
  magic: 0xd9b4bef9,
  formats: ['bip44', 'bip32'],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 145
  },
  addressPrefix: {
    pubkeyhash: 0x00,
    scripthash: 0x05,
    cashAddress: 'bitcoincash'
  },
  replayProtection: {
    SIGHASH_FORKID: 0x40,
    forcedMinVersion: 1,
    forkId: 0
  }
}

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
  currencyName: 'Bitcoin SV',
  pluginName: 'bitcoinsv',
  denominations: [
    { name: 'BSV', multiplier: '100000000', symbol: '₿' },
    { name: 'mBSV', multiplier: '100000', symbol: 'm₿' },
    { name: 'cash', multiplier: '100', symbol: 'ƀ' }
  ],

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!! - About to be deprecated - !!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  walletTypes: ['wallet:bitcoinsv', 'wallet:bitcoinsv-bip44'],

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
  blockExplorer: 'https://blockchair.com/bitcoin-sv/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin-sv/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin-sv/transaction/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoinsv-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoinsv-logo-solo-64.png`
}

export const bitcoinsv = { bcoinInfo, engineInfo, currencyInfo }
