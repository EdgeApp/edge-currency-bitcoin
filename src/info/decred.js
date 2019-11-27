// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'decred',
  magic: 0xd9b400f9,
  formats: ['bip44', 'bip32'],
  forks: [],
  keyPrefix: {
    privkey: 0x22de, // WIF_BYT
    xpubkey: 0x02fda926, // XPUB_VERBYTES
    xprivkey: 0x02fda4e8, // XPRV_VERBYTES
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 42
  },
  addressPrefix: {
    pubkeyhash: 0x0073f, // P2PKH_VERBYTE
    scripthash: 0x0071a, // P2SH_VERBYTES
    // witnesspubkeyhash: 0x06,
    // witnessscripthash: 0x0a,
    // bech32: 'bc'
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'decred',
  currencyCode: 'DCR',
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'DCR',
  displayName: 'Decred',
  pluginName: 'decred',
  denominations: [
    { name: 'DCR', multiplier: '100000000', symbol: 'DCR' }
  ],
  walletType: 'wallet:decred',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      '209.250.246.201:9108',
      '88.198.53.172:9108',
      '52.62.64.145:9108',
      '138.68.238.246:9108',
      '209.126.111.161:9108',
      '107.179.246.222:9108',
      '13.127.22.242:9108',
      '104.37.172.184:9108',
      '80.211.221.61:9108',
      '167.99.193.132:9108',
      '50.3.68.112:9108'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://mainnet.decred.org/block/%s',
  addressExplorer: 'https://mainnet.decred.org/address/%s',
  transactionExplorer: 'https://mainnet.decred.org/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/decred-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/decred-logo-solo-64.png`
}

export const bitcoin = { bcoinInfo, engineInfo, currencyInfo }
