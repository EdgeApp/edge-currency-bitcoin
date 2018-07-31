// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'eboost',
  magic: 0xd9b4bef9,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  keyPrefix: {
    privkey: 0xb0,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 2
  },
  addressPrefix: {
    pubkeyhash: 0x5c,
    scripthash: 0x0a,
    scripthashLegacy: 0x05,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'ebst'
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'eboost',
  currencyCode: 'EBST',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 50000,
  feeUpdateInterval: 60000,
  infoServer: 'https://info1.edgesecure.co:8444/v1',
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
  currencyCode: 'EBST',
  currencyName: 'eBoost',
  pluginName: 'eboost',
  denominations: [
    { name: 'EBST', multiplier: '100000000', symbol: 'EBST' },
    { name: 'mEBST', multiplier: '100000', symbol: 'mEBST' }
  ],

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!! - About to be deprecated - !!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  walletTypes: [
    'wallet:eboost-bip84',
    'wallet:eboost-bip49',
    'wallet:eboost-bip44',
    'wallet:eboost'
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrums://electrum1.eboost.org:50001',
      'electrums://electrum2.eboost.org:50001',
      'electrums://electrum3.eboost.org:50001'
    ],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://www.blockexperts.com/ebst/address/%s',
  blockExplorer: 'https://www.blockexperts.com/ebst/hash/%s',
  transactionExplorer: 'https://www.blockexperts.com/ebst/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/eboost-logo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/eboost-logo-64.png`
}

export const eboost = { bcoinInfo, engineInfo, currencyInfo }
