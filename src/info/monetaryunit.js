// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'monetaryunit',
  magic: 0xd9b4bef9, // ?
  formats: ['bip44', 'bip32'],
  keyPrefix: {
    privkey: 0x7e, // done
    xpubkey: 0x022d2533,
    xprivkey: 0x0221312b,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 31 // https://github.com/satoshilabs/slips/blob/master/slip-0044.md
  },
  addressPrefix: {
    pubkeyhash: 0x10, // done
    scripthash: 0x4c // done
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'monetaryunit',
  currencyCode: 'MUE',
  gapLimit: 10,
  maxFee: 100000,
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
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'MUE',
  displayName: 'MonetaryUnit',
  pluginName: 'monetaryunit',
  denominations: [{ name: 'MUE', multiplier: '100000000', symbol: 'M' }],
  walletType: 'wallet:monetaryunit',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
    'electrum://electrum1.monetaryunit.org:50001',
    'electrum://electrum2.monetaryunit.org:50001',
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://explorer.monetaryunit.org/address/%s',
  blockExplorer: 'https://explorer.monetaryunit.org/block/%s',
  transactionExplorer: 'https://explorer.monetaryunit.org/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/monetaryunit-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/monetaryunit-logo-solo-64.png`
}

export const monetaryunit = { bcoinInfo, engineInfo, currencyInfo }
