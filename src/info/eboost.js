// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'eboost',
  magic: 0xddb7d9fc,
  formats: ['bip44', 'bip32'],
  keyPrefix: {
    privkey: 0xb0,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 324
  },
  addressPrefix: {
    pubkeyhash: 0x5c,
    scripthash: 0x05
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'eboost',
  currencyCode: 'EBST',
  gapLimit: 10,
  defaultFee: 500000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  minRelayFee: '100',
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
  currencyCode: 'EBST',
  displayName: 'eBoost',
  pluginId: 'eboost',
  denominations: [
    { name: 'EBST', multiplier: '100000000', symbol: 'EBST' },
    { name: 'mEBST', multiplier: '100000', symbol: 'mEBST' }
  ],
  walletType: 'wallet:eboost',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrum1.eboost.fun:50001',
      'electrum://electrum2.eboost.fun:50001',
      'electrum://electrum3.eboost.fun:50001'
    ],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://www.blockexperts.com/ebst/address/%s',
  blockExplorer: 'https://www.blockexperts.com/ebst/hash/%s',
  transactionExplorer: 'https://www.blockexperts.com/ebst/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/eboost-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/eboost-logo-solo-64.png`
}

export const eboost = { bcoinInfo, engineInfo, currencyInfo }
