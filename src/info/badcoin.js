// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'badcoin',
  magic: 0x33c3ffaa,
  formats: ['bip44', 'bip32'],
  keyPrefix: {
    privkey: 0xb0,
    xpubkey: 0x06c4abc8,
    xprivkey: 0x06c4abc9,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 324
  },
  addressPrefix: {
    pubkeyhash: 0x1c,
    scripthash: 0x19
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'badcoin',
  currencyCode: 'BAD',
  gapLimit: 10,
  defaultFee: 500000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '300',
    lowFee: '100',
    standardFeeLow: '150',
    standardFeeHigh: '200',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'BAD',
  displayName: 'Badcoin',
  pluginName: 'badcoin',
  denominations: [
    { name: 'BAD', multiplier: '100000000', symbol: 'BAD' },
    { name: 'mBAD', multiplier: '100000', symbol: 'mBAD' }
  ],
  walletType: 'wallet:badcoin',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://badcoin-electrum-1.cryptocoinnodes.com:50001'
    ],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://www.blockingbad.com/address/%s',
  blockExplorer: 'https://www.blockingbad.com/block/%s',
  transactionExplorer: 'https://www.blockingbad.com/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bad-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bad-logo-solo-64.png`
}

export const badcoin = { bcoinInfo, engineInfo, currencyInfo }
