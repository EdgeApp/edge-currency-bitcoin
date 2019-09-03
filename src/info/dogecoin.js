// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'dogecoin',
  magic: 0x00000000,
  formats: ['bip44', 'bip32'],
  keyPrefix: {
    privkey: 0x9e,
    xpubkey: 0x02facafd,
    xprivkey: 0x02fac398,
    xprivkey58: 'xprv',
    xpubkey58: 'xpub',
    coinType: 3
  },
  addressPrefix: {
    pubkeyhash: 0x1e,
    scripthash: 0x16
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'dogecoin',
  currencyCode: 'DOGE',
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 10000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '1000',
    lowFee: '100',
    standardFeeLow: '500',
    standardFeeHigh: '750',
    standardFeeLowAmount: '2000000000',
    standardFeeHighAmount: '98100000000'
  },
  timestampFromHeader (header: Buffer): number {
    if (header.length < 80) {
      throw new Error(`Cannot interpret block header ${header.toString('hex')}`)
    }
    return header.readUInt32LE(4 + 32 + 32)
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'DOGE',
  displayName: 'Dogecoin',
  pluginName: 'dogecoin',
  denominations: [{ name: 'DOGE', multiplier: '100000000', symbol: 'Ð' }],
  walletType: 'wallet:dogecoin',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrum-alts-wusa2.edge.app:50011',
      'electrum://electrum-alts-neuro.edge.app:50011'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/dogecoin/block/%s',
  addressExplorer: 'https://blockchair.com/dogecoin/address/%s',
  transactionExplorer: 'https://blockchair.com/dogecoin/transaction/%s',

  // Images:
  symbolImage: `${imageServerUrl}/dogecoin-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/dogecoin-logo-solo-64.png`
}

export const dogecoin = { bcoinInfo, engineInfo, currencyInfo }
