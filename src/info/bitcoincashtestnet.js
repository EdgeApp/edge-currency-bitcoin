// @flow
import type { EdgeCurrencyInfo } from '../utils/flowTypes.js'
import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'bitcoincashtestnet',
  magic: 0x0709110b,
  supportedBips: [44, 32],
  keyPrefix: {
    privkey: 0xef,
    xpubkey: 0x043587cf,
    xprivkey: 0x04358394,
    xpubkey58: 'tpub',
    xprivkey58: 'tprv',
    coinType: 1
  },
  addressPrefix: {
    pubkeyhash: 0x6f,
    scripthash: 0xc4,
    cashAddress: 'bchtest'
  },
  replayProtection: {
    SIGHASH_FORKID: 0x40,
    forcedMinVersion: 1,
    forkId: 0
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcoincashtestnet',
  currencyCode: 'TBCH',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 10000,
  feeUpdateInterval: 60000,
  feeInfoServer: '',
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '10',
    lowFee: '1',
    standardFeeLow: '5',
    standardFeeHigh: '9',
    standardFeeLowAmount: '10000',
    standardFeeHighAmount: '6500000000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'TBCH',
  currencyName: 'Bitcoin Cash Testnet',
  pluginName: 'bitcoincashtestnet',
  denominations: [
    { name: 'TBCH', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBCH', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [['h.1209k.com', '50001']],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin-cash/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin-cash/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin-cash/transaction/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoincash-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoincash-logo-solo-64.png`
}

export const bitcoincashTestnet = { bcoinInfo, engineInfo, currencyInfo }
