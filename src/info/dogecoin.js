// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'

export const dogecoinInfo: EdgeCurrencyInfo = {
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
        privkey: 0x9e,
        xpubkey: 0x02facafd,
        xprivkey: 0x02fac398,
        xprivkey58: 'xprv',
        xpubkey58: 'xpub',
        coinType: 3
      },
      addressPrefix: {
        pubkeyhash: 0x1e,
        scripthash: 0x16,
        witnesspubkeyhash: null,
        witnessscripthash: null,
        bech32: null
      }
    },
    customFeeSettings: ['satPerByte'],
    gapLimit: 25,
    maxFee: 1000000,
    feeUpdateInterval: 10000,
    feeInfoServer: '',
    infoServer: '',
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
  symbolImage: ''
}
