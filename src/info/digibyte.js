// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'digibyte',
  magic: 0xd9b4bef9,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  forks: [],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 20
  },
  addressPrefix: {
    pubkeyhash: 0x1e,
    scripthash: 0x05,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'dgb'
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'digibyte',
  currencyCode: 'DGB',
  gapLimit: 10,
  maxFee: 1000000,
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
  currencyCode: 'DGB',
  currencyName: 'Digibyte',
  pluginName: 'digibyte',
  denominations: [
    { name: 'DGB', multiplier: '100000000', symbol: '₿' },
    { name: 'mDGB', multiplier: '100000', symbol: 'm₿' }
  ],

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!! - About to be deprecated - !!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  walletTypes: [
    'wallet:digibyte',
    'wallet:digibyte-bip84',
    'wallet:digibyte-bip49',
    'wallet:digibyte-bip44'
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrum-alts-wusa2-az.edge.app:50021',
      'electrum://electrum-alts-weuro-az.edge.app:50021',
      'electrum://electrum-alts-ejapan-az.edge.app:50021'
    ],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://digiexplorer.info/block/%s',
  addressExplorer: 'https://digiexplorer.info/address/%s',
  transactionExplorer: 'https://digiexplorer.info/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/digibyte-logo-color-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/digibyte-logo-grey-64.png`
}

export const digibyte = { bcoinInfo, engineInfo, currencyInfo }
