// @flow
import type { AbcCurrencyInfo } from 'airbitz-core-types'

export const dogecoinInfo: AbcCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'DOGE',
  currencyName: 'Dogecoin',
  pluginName: 'dogecoin',
  denominations: [{ name: 'DOGE', multiplier: '100000000', symbol: 'Ð' }],
  walletTypes: ['wallet:dogecoin-bip44'],

  // Configuration options:
  defaultSettings: {
    network: {
      type: 'dogecoin',
      magic: 0x00000000,
      keyPrefix: {
        privkey: 0xb0,
        xpubkey: 0x00000000,
        xprivkey: 0x00000000,
        xprivkey58: 'xprv',
        xpubkey58: 'xpub',
        coinType: 3
      },
      addressPrefix: {
        pubkeyhash: 0x30,
        scripthash: 0x32,
        witnesspubkeyhash: 0x06,
        witnessscripthash: 0x0a,
        bech32: 'lc'
      }
    },
    gapLimit: 25,
    maxFee: 1000000,
    feeUpdateInterval: 10000,
    feeInfoServer: '',
    simpleFeeSettings: {
      highFee: '1000',
      lowFee: '100',
      standardFeeLow: '500',
      standardFeeHigh: '750',
      standardFeeLowAmount: '',
      standardFeeHighAmount: ''
    },
    electrumServers: []
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://live.blockcypher.com/doge/address/%s',
  blockExplorer: 'https://live.blockcypher.com/doge/block/%s',
  transactionExplorer: 'https://live.blockcypher.com/doge/tx/%s',

  // Images:
  symbolImage:
    'data:image/png;base64,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'
}
