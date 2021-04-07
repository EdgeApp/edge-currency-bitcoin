// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'litecoin',
  magic: 0xd9b4bef9,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  keyPrefix: {
    privkey: 0xb0,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 2
  },
  addressPrefix: {
    pubkeyhash: 0x30,
    scripthash: 0x32,
    scripthashLegacy: 0x05,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'ltc'
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'litecoin',
  currencyCode: 'LTC',
  gapLimit: 10,
  defaultFee: 50000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '300',
    lowFee: '100',
    standardFeeLow: '150',
    standardFeeHigh: '200',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'LTC',
  displayName: 'Litecoin',
  pluginId: 'litecoin',
  denominations: [
    { name: 'LTC', multiplier: '100000000', symbol: 'Ł' },
    { name: 'mLTC', multiplier: '100000', symbol: 'mŁ' }
  ],
  walletType: 'wallet:litecoin',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrum-ltc.festivaldelhumor.org:60001',
      'electrum://electrum-ltc.petrkr.net:60001',
      'electrum://electrumx.nmdps.net:9433',
      'electrums://electrum-ltc.festivaldelhumor.org:60002',
      'electrums://electrum-ltc.petrkr.net:60002',
      'electrums://electrum-ltc.villocq.com:60002',
      'electrum://electrum-ltc.villocq.com:60001',
      'electrums://elec.luggs.co:444',
      'electrums://ltc01.knas.systems:50004',
      'electrum://ltc01.knas.systems:50003',
      'electrums://electrum-ltc.wilv.in:50002',
      'electrum://electrum-ltc.wilv.in:50001',
      'electrums://electrum.ltc.xurious.com:50002',
      'electrum://electrum.ltc.xurious.com:50001',
      'electrums://lith.strangled.net:50003',
      'electrums://electrum.leblancnet.us:50004',
      'electrum://electrum.leblancnet.us:50003',
      'electrums://electrum-ltc0.snel.it:50004',
      'electrum://electrum-ltc0.snel.it:50003',
      'electrums://e-2.claudioboxx.com:50004',
      'electrum://e-2.claudioboxx.com:50003',
      'electrums://e-1.claudioboxx.com:50004',
      'electrum://e-1.claudioboxx.com:50003',
      'electrum://node.ispol.sk:50003',
      'electrums://electrum-ltc.bysh.me:50002',
      'electrum://electrum-ltc.bysh.me:50001',
      'electrums://e-3.claudioboxx.com:50004',
      'electrum://e-3.claudioboxx.com:50003',
      'electrums://node.ispol.sk:50004',
      'electrums://electrumx.nmdps.net:9434'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/litecoin/block/%s?from=edgeapp',
  addressExplorer: 'https://blockchair.com/litecoin/address/%s?from=edgeapp',
  transactionExplorer:
    'https://blockchair.com/litecoin/transaction/%s?from=edgeapp',

  // Images:
  symbolImage: `${imageServerUrl}/litecoin-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/litecoin-logo-solo-64.png`
}

export const litecoin = { bcoinInfo, engineInfo, currencyInfo }
