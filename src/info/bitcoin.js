// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import { imageServerUrl } from './constants.js'

export const bitcoinInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'BTC',
  currencyName: 'Bitcoin',
  pluginName: 'bitcoin',
  denominations: [
    { name: 'BTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],
  walletTypes: [
    'wallet:bitcoin-bip49',
    'wallet:bitcoin-bip44',
    'wallet:bitcoin'
  ],

  // Configuration options:
  defaultSettings: {
    network: {
      type: 'bitcoin',
      magic: 0xd9b4bef9,
      keyPrefix: {
        privkey: 0x80,
        xpubkey: 0x0488b21e,
        xprivkey: 0x0488ade4,
        xpubkey58: 'xpub',
        xprivkey58: 'xprv',
        coinType: 0
      },
      addressPrefix: {
        pubkeyhash: 0x00,
        scripthash: 0x05,
        witnesspubkeyhash: 0x06,
        witnessscripthash: 0x0a,
        bech32: 'bc'
      }
    },
    customFeeSettings: ['satPerByte'],
    gapLimit: 10,
    maxFee: 1000000,
    defaultFee: 1000,
    feeUpdateInterval: 60000,
    feeInfoServer: 'https://bitcoinfees.21.co/api/v1/fees/list',
    infoServer: 'https://info1.edgesecure.co:8444/v1',
    simpleFeeSettings: {
      highFee: '150',
      lowFee: '20',
      standardFeeLow: '50',
      standardFeeHigh: '100',
      standardFeeLowAmount: '173200',
      standardFeeHighAmount: '8670000'
    },
    electrumServers: [
      'electrums://electrum-bc-az-eusa.airbitz.co:50002',
      'electrum://electrum-bc-az-eusa.airbitz.co:50001',
      'electrum://electrum.hsmiths.com:8080',
      'electrums://E-X.not.fyi:50002',
      'electrums://node.arihanc.com:50002',
      'electrum://node.arihanc.com:50001',
      'electrums://electrum.petrkr.net:50002',
      'electrum://electrum.petrkr.net:50001',
      'electrums://electrum2.everynothing.net:50002',
      'electrum://electrum2.everynothing.net:50001',
      'electrums://lith.strangled.net:50002',
      'electrums://s4.noip.pl:50104',
      'electrum://currentlane.lovebitco.in:50001',
      'electrums://electrum.hsmiths.com:50002',
      'electrum://electrum.hsmiths.com:50001',
      'electrums://electrumx.westeurope.cloudapp.azure.com:50002',
      'electrum://electrumx.westeurope.cloudapp.azure.com:50001'
    ]
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin/transaction/%s',

  // Images:
  symbolImage:
    `${imageServerUrl}/bitcoin-logo-color-64.png`,
  symbolImageDarkMono:
    `${imageServerUrl}/bitcoin-logo-grey-64.png`
}
