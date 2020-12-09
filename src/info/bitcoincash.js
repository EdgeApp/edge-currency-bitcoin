// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { cashAddress, scriptTemplates } from './bitcoincashUtils/cashUtils'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'bitcoincash',
  magic: 0xd9b4bef9,
  formats: ['bip44', 'bip32'],
  forks: ['bitcoincashsv'],
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
    pubkeyhashLegacy: 0x00,
    scripthash: 0x05,
    scripthashLegacy: 0x05
  },
  serializers: {
    address: cashAddress('bitcoincash')
  },
  replayProtection: {
    SIGHASH_FORKID: 0x40,
    forcedMinVersion: 1,
    forkId: 0
  },
  scriptTemplates
}

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcoincash',
  currencyCode: 'BCH',
  gapLimit: 10,
  defaultFee: 10000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '20',
    lowFee: '3',
    standardFeeLow: '5',
    standardFeeHigh: '10',
    standardFeeLowAmount: '1000000',
    standardFeeHighAmount: '65000000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'BCH',
  displayName: 'Bitcoin Cash',
  pluginId: 'bitcoincash',
  denominations: [
    { name: 'BCH', multiplier: '100000000', symbol: '₿' },
    { name: 'mBCH', multiplier: '100000', symbol: 'm₿' },
    { name: 'cash', multiplier: '100', symbol: 'ƀ' }
  ],
  walletType: 'wallet:bitcoincash',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
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
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin-cash/block/%s?from=edgeapp',
  addressExplorer:
    'https://blockchair.com/bitcoin-cash/address/%s?from=edgeapp',
  transactionExplorer:
    'https://blockchair.com/bitcoin-cash/transaction/%s?from=edgeapp',
  xpubExplorer: 'https://blockchair.com/bitcoin-cash/xpub/%s?from=edgeapp',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoincash-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoincash-logo-solo-64.png`
}

export const bitcoincash = { bcoinInfo, engineInfo, currencyInfo }
