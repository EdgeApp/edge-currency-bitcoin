// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'feathercoin',
  magic: 0xd9b4bef9,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  keyPrefix: {
    privkey: 0x8e,
    xpubkey: 0x0488bc26,
    xprivkey: 0x0488daee,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 8
  },
  addressPrefix: {
    pubkeyhash: 0x0e,
    scripthash: 0x05,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'fc'
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'feathercoin',
  currencyCode: 'FTC',
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '1200',
    lowFee: '400',
    standardFeeLow: '600',
    standardFeeHigh: '800',
    standardFeeLowAmount: '2000000000',
    standardFeeHighAmount: '98100000000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'FTC',
  displayName: 'Feathercoin',
  pluginId: 'feathercoin',
  denominations: [
    { name: 'FTC', multiplier: '100000000', symbol: 'F' },
    { name: 'mFTC', multiplier: '100000', symbol: 'mF' }
  ],
  walletType: 'wallet:feathercoin',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrumx-ch-1.feathercoin.ch:50001',
      'electrum://electrumx-de-2.feathercoin.ch:50001',
      'electrum://electrumxftc.trezarcoin.com:50001',
      'electrum://electrum.feathercoin.network:50001'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://fsight.chain.tips/address/%s',
  blockExplorer: 'https://fsight.chain.tips/block/%s',
  transactionExplorer: 'https://fsight.chain.tips/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/feathercoin-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/feathercoin-logo-solo-64.png`
}

export const feathercoin = { bcoinInfo, engineInfo, currencyInfo }
