// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import { imageServerUrl } from './constants.js'

export const bitcoincashTestnetInfo: AbcCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'BCH',
  currencyName: 'BitcoinCashTestnet',
  pluginName: 'bitcoincashtestnet',
  denominations: [
    { name: 'BCH', multiplier: '100000000', symbol: '₿' },
    { name: 'mBCH', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],
  walletTypes: [
    'wallet:bitcoincash-bip44-testnet',
    'wallet:bitcoincash-testnet'
  ],

  // Configuration options:
  defaultSettings: {
    network: {
      type: 'bitcoincashtestnet',
      magic: 0x0709110b,
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
        witnesspubkeyhash: null,
        witnessscripthash: null,
        bech32: null
      },
      newAddressFormat: {
        pubkeyhash: 0x00,
        scripthash: 0x08,
        witnesspubkeyhash: null,
        witnessscripthash: null,
        prefix: 'bchtest'
      }
    },
    customFeeSettings: ['satPerByte'],
    gapLimit: 10,
    maxFee: 1000000,
    defaultFee: 10000,
    feeUpdateInterval: 60000,
    feeInfoServer: '',
    simpleFeeSettings: {
      highFee: '10',
      lowFee: '1',
      standardFeeLow: '5',
      standardFeeHigh: '9',
      standardFeeLowAmount: '10000',
      standardFeeHighAmount: '6500000000'
    },
    electrumServers: [['h.1209k.com', '50001']]
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin-cash/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin-cash/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin-cash/transaction/%s',

  // Images:
  symbolImage:
    `${imageServerUrl}/bitcoincash-logo-color-64.png`,
  symbolImageDarkMono:
    `${imageServerUrl}/bitcoincash-logo-grey-64.png`
}
