// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'bitcoin',
  magic: 0xd9b4bef9,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  forks: ['bitcoincash', 'bitcoingold', 'bitcoindiamond'],
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
}

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcoin',
  currencyCode: 'BTC',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  feeInfoServer: 'https://bitcoinfees.21.co/api/v1/fees/list',
  infoServer: 'https://info1.edgesecure.co:8444/v1',
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'BTC',
  currencyName: 'Bitcoin',
  pluginName: 'bitcoin',
  denominations: [
    { name: 'BTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!! - About to be deprecated - !!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  walletTypes: [
    'wallet:bitcoin',
    'wallet:bitcoin-bip84',
    'wallet:bitcoin-bip49',
    'wallet:bitcoin-bip44'
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
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
    ],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin/transaction/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoin-logo-color-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoin-logo-grey-64.png`
}

export const bitcoin = { bcoinInfo, engineInfo, currencyInfo }
