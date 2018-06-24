// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import { imageServerUrl } from './constants.js'

export const bitcoinTestnetInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'BTC',
  currencyName: 'BitcoinTestnet',
  pluginName: 'bitcointestnet',
  denominations: [
    { name: 'BTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],
  walletTypes: [
    'wallet:bitcoin-bip49-testnet',
    'wallet:bitcoin-bip44-testnet',
    'wallet:bitcoin-testnet'
  ],

  // Configuration options:
  defaultSettings: {
    network: {
      type: 'bitcointestnet',
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
        witnesspubkeyhash: 0x03,
        witnessscripthash: 0x28,
        bech32: 'tb'
      }
    },
    customFeeSettings: ['satPerByte'],
    gapLimit: 10,
    maxFee: 1000000,
    defaultFee: 1000,
    feeUpdateInterval: 60000,
    feeInfoServer: '',
    infoServer: '',
    simpleFeeSettings: {
      highFee: '30',
      lowFee: '5',
      standardFeeLow: '10',
      standardFeeHigh: '15',
      standardFeeLowAmount: '17320',
      standardFeeHighAmount: '86700000'
    },
    electrumServers: [
      'electrum://estnet.qtornado.com:51001',
      'electrum://testnet.hsmiths.com:53011',
      'electrum://testnet1.bauerj.eu:50001',
      'electrum://electrum.akinbo.org:51001',
      'electrum://hsmithsxurybd7uh.onion:53011',
      'electrum://testnetnode.arihanc.com:51001',
      'electrum://electrum.akinbo.org:51001',
      'electrum://testnet1.bauerj.eu:50001',
      'electrum://testnet.qtornado.com:51001',
      'electrum://testnet.hsmiths.com:53011',
      'electrums://testnet.hsmiths.com:53012',
      'electrums://testnet.qtornado.com:51002',
      'electrums://electrum.akinbo.org:51002',
      'electrum://testnetnode.arihanc.com:51001'
    ]
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://test-insight.bitpay.com//block/%s',
  addressExplorer: 'https://test-insight.bitpay.com//address/%s',
  transactionExplorer: 'https://test-insight.bitpay.com//tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoin-logo-color-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoin-logo-grey-64.png`
}
