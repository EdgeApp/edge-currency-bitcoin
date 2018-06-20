// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import { imageServerUrl } from './constants.js'

export const bitcoincashInfo: AbcCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'BCH',
  currencyName: 'BitcoinCash',
  pluginName: 'bitcoincash',
  denominations: [
    { name: 'BCH', multiplier: '100000000', symbol: '₿' },
    { name: 'mBCH', multiplier: '100000', symbol: 'm₿' },
    { name: 'cash', multiplier: '100', symbol: 'ƀ' }
  ],
  walletTypes: ['wallet:bitcoincash-bip44', 'wallet:bitcoincash'],

  // Configuration options:
  defaultSettings: {
    network: {
      type: 'bitcoincash',
      magic: 0xd9b4bef9,
      keyPrefix: {
        privkey: 0x80,
        xpubkey: 0x0488b21e,
        xprivkey: 0x0488ade4,
        xpubkey58: 'xpub',
        xprivkey58: 'xprv',
        coinType: 145
      },
      addressPrefix: {
        pubkeyhash: 0x00,
        scripthash: 0x05,
        witnesspubkeyhash: null,
        witnessscripthash: null,
        bech32: null
      },
      newAddressFormat: {
        pubkeyhash: 0x00,
        scripthash: 0x05,
        witnesspubkeyhash: null,
        witnessscripthash: null,
        prefix: 'bitcoincash'
      }
    },
    customFeeSettings: ['satPerByte'],
    gapLimit: 10,
    maxFee: 1000000,
    defaultFee: 10000,
    feeUpdateInterval: 60000,
    feeInfoServer: '',
    infoServer: 'https://info1.edgesecure.co:8444/v1',
    simpleFeeSettings: {
      highFee: '20',
      lowFee: '3',
      standardFeeLow: '5',
      standardFeeHigh: '10',
      standardFeeLowAmount: '1000000',
      standardFeeHighAmount: '65000000'
    },
    electrumServers: [
      'electrum://abc1.hsmiths.com:60001',
      'electrums://electroncash.bitcoinplug.com:50002',
      'electrum://electroncash.bitcoinplug.com:50001',
      'electrums://bch.tedy.pw:50002',
      'electrum://bch.tedy.pw:50001',
      'electrums://electroncash.cascharia.com:50002',
      'electrums://14.3.38.179:50002',
      'electrum://14.3.38.179:50001',
      'electrums://bch.arihanc.com:52002',
      'electrum://bch.arihanc.com:52001',
      'electrums://electron-cash.dragon.zone:50002',
      'electrum://electron-cash.dragon.zone:50001',
      'electrum://bch.stitthappens.com:50001',
      'electrum://abc.vom-stausee.de:52001',
      'electrums://electron.coinucopia.io:50002',
      'electrum://electron.coinucopia.io:50001',
      'electrums://elecash.bcc.nummi.it:50012',
      'electrum://electron.jns.im:50001',
      'electrums://electrum.leblancnet.us:50012',
      'electrum://electrum.leblancnet.us:50011',
      'electrums://bch.curalle.ovh:50002',
      'electrums://electron.jns.im:50002',
      'electrums://abc.vom-stausee.de:52002',
      'electrums://abc1.hsmiths.com:60002',
      'electrum://electrumx-cash.itmettke.de:50001',
      'electrums://electrumx-cash.itmettke.de:50002',
      'electrums://electrumx-bch.adminsehow.com:50012',
      'electrum://electrumx-bch.adminsehow.com:50011'
    ]
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
