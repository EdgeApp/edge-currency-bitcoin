// @flow
import type { AbcCurrencyInfo } from 'edge-login'

export const bitcoincashInfo: AbcCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'BCH',
  currencyName: 'BitcoinCash',
  pluginName: 'bitcoincash',
  denominations: [
    { name: 'BCH', multiplier: '100000000', symbol: '₿' },
    { name: 'mBCH', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
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
    infoServer: 'https://info1.edgesecure.co:8444/v1/electrumServers/BCH',
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
    'data:image/png;base64,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',
  symbolImageDarkMono:
    'data:image/png;base64,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'
}
