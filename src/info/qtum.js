// @flow
import type { AbcCurrencyInfo } from 'edge-core-js'

export const qtumInfo: AbcCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'QTUM',
  currencyName: 'Qtum',
  pluginName: 'qtum',
  denominations: [
    { name: 'QTUM', multiplier: '100000000', symbol: 'Q' }
  ],
  walletTypes: [
    'wallet:qtum-bip44'
  ],

  // Configuration options:
  defaultSettings: {
    network: {
      type: 'qtum',
      magic: 0xf1cfa6d3,
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
        scripthash: 0x32,
        witnesspubkeyhash: null,
        witnessscripthash: null,
        bech32: null
      }
    },
    customFeeSettings: ['satPerByte'],
    gapLimit: 10,
    maxFee: 1000000,
    defaultFee: 1000,
    feeUpdateInterval: 60000,
    feeInfoServer: '',
    infoServer: 'https://info1.edgesecure.co:8444/v1',
    simpleFeeSettings: {
      highFee: '1000',
      lowFee: '400',
      standardFeeLow: '450',
      standardFeeHigh: '700',
      standardFeeLowAmount: '20000000',
      standardFeeHighAmount: '981000000'
    },
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
    ]
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://explorer.qtum.org/block/%s',
  addressExplorer: 'https://explorer.qtum.org/address/%s',
  transactionExplorer: 'https://explorer.qtum.org/tx/%s',

  // Images:
  symbolImage:
    'https://developer.airbitz.co/content/qtum-logo-64.png',
  symbolImageDarkMono:
    'https://developer.airbitz.co/content/qtum-logo-mono-64.png'
}
