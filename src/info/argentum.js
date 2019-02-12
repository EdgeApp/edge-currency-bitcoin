// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'argentum',
  magic: 0xfbc1b8dc,
  formats: ['bip44', 'bip32'],
  forks: [],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 45
  },
  addressPrefix: {
    pubkeyhash: 0x17,
    scripthash: 0x05
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'argentum',
  currencyCode: 'ARG',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 1000,
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
  currencyCode: 'ARG',
  currencyName: 'Argentum',
  pluginName: 'argentum',
  denominations: [
    { name: 'ARG', multiplier: '100000000', symbol: 'A' },
    { name: 'mARG', multiplier: '100000', symbol: 'mA' }
  ],

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!! - About to be deprecated - !!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  walletTypes: ['wallet:argentum', 'wallet:argentum-bip44'],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrumx.electrum-arg.org:50002',
      'electrum://electrumx.electrum-arg.org:50001'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://chainz.cryptoid.info/arg/block.dws?',
  addressExplorer: 'https://chainz.cryptoid.info/arg/address.dws?',
  transactionExplorer: 'https://chainz.cryptoid.info/arg/tx.dws?',

  // Images:
  symbolImage: `${imageServerUrl}/argentum-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/argentum-logo-solo-64.png`
}

export const argentum = { bcoinInfo, engineInfo, currencyInfo }
