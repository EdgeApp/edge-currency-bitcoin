// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'

export const ufoInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'UFO',
  currencyName: 'UFO Coin',
  pluginName: 'ufo',
  denominations: [
    { name: 'kUFO', multiplier: '100000000000', symbol: 'kU' },
    { name: 'UFO', multiplier: '100000000', symbol: 'U' }
  ],
  walletTypes: [
    'wallet:ufo-bip49'
  ],

  // Configuration options:
  defaultSettings: {
    forks: [],
    network: {
      type: 'uniformfiscalobject',
      magic: 0xfcd9b7dd,
      keyPrefix: {
        privkey: 0x9B,
        xpubkey: 0x0488B21E,
        xprivkey: 0x0488ADE4,
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
  addressExplorer: 'https://chainz.cryptoid.info/ufo/address.dws?%s.htm',
  blockExplorer: 'https://chainz.cryptoid.info/ufo/block.dws?%s.htm',
  transactionExplorer: 'https://chainz.cryptoid.info/ufo/tx.dws?%s.htm',

  // Images:
  symbolImage:
    'https://developer.airbitz.co/content/ufo_64_white.png',
  symbolImageDarkMono:
    'https://developer.airbitz.co/content/ufo_64_87939D.png'
}
