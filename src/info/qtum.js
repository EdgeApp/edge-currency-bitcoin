// @flow
import type { EdgeCurrencyInfo } from '../utils/flowTypes.js'
import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'qtum',
  magic: 0xf1cfa6d3,
  supportedBips: [44, 32],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 2301
  },
  addressPrefix: {
    pubkeyhash: 0x3a,
    scripthash: 0x32
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'qtum',
  currencyCode: 'QTUM',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '1000',
    lowFee: '400',
    standardFeeLow: '450',
    standardFeeHigh: '700',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'QTUM',
  currencyName: 'Qtum',
  pluginName: 'qtum',
  denominations: [{ name: 'QTUM', multiplier: '100000000', symbol: 'Q' }],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://s1.qtum.info:50001',
      'electrum://s2.qtum.info:50001',
      'electrum://s3.qtum.info:50001',
      'electrum://s4.qtum.info:50001',
      'electrum://s5.qtum.info:50001',
      'electrum://s6.qtum.info:50001',
      'electrum://s7.qtum.info:50001',
      'electrum://s8.qtum.info:50001',
      'electrum://s9.qtum.info:50001'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://explorer.qtum.org/block/%s',
  addressExplorer: 'https://explorer.qtum.org/address/%s',
  transactionExplorer: 'https://explorer.qtum.org/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/qtum-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/qtum-logo-solo-64.png`
}

export const qtum = { bcoinInfo, engineInfo, currencyInfo }
