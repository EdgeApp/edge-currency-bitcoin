// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import { imageServerUrl } from './constants.js'

export const ufoInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'UFO',
  currencyName: 'UFO Coin',
  pluginName: 'ufo',
  denominations: [
    { name: 'UFO', multiplier: '100000000', symbol: 'U' },
    { name: 'kUFO', multiplier: '100000000000', symbol: 'kU' }
  ],
  walletTypes: ['wallet:ufo-bip49'],

  // Configuration options:
  defaultSettings: {
    forks: [],
    network: {
      type: 'uniformfiscalobject',
      magic: 0xfcd9b7dd,
      keyPrefix: {
        privkey: 0x9b,
        xpubkey: 0x0488b21e,
        xprivkey: 0x0488ade4,
        xpubkey58: 'xpub',
        xprivkey58: 'xprv',
        coinType: 202
      },
      addressPrefix: {
        pubkeyhash: 0x1b,
        scripthash: 0x44,
        // legacy: 0x05,
        witnesspubkeyhash: 0x06,
        witnessscripthash: 0x0a,
        bech32: 'uf'
      }
    },
    customFeeSettings: ['satPerByte'],
    gapLimit: 10,
    maxFee: 1000000,
    defaultFee: 50000,
    feeUpdateInterval: 60000,
    feeInfoServer: '',
    infoServer: 'https://info1.edgesecure.co:8444/v1',
    simpleFeeSettings: {
      highFee: '2250',
      lowFee: '1000',
      standardFeeLow: '1100',
      standardFeeHigh: '2000',
      standardFeeLowAmount: '51282051282051',
      standardFeeHighAmount: '5128205128205100'
    },
    electrumServers: [
      'electrum://electrumx1.ufobject.com:50001',
      'electrum://electrumx2.ufobject.com:50001',
      'electrum://electrumx3.ufobject.com:50001',
      'electrum://electrumx4.ufobject.com:50001',
      'electrum://electrumx5.ufobject.com:50001'
    ]
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://explorer.ufobject.com/address/%s',
  blockExplorer: 'https://explorer.ufobject.com/blocks/%s',
  transactionExplorer: 'https://explorer.ufobject.com/tx/%s',

  // Images:
  symbolImage:
    `${imageServerUrl}/ufo_64_white.png`,
  symbolImageDarkMono:
    `${imageServerUrl}/ufo_64_87939D.png`
}
