// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

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
  gapLimit: 25,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  earnComFeeInfoServer: 'https://Bitcoinfees.Earn.com/api/v1/fees/list',
  mempoolSpaceFeeInfoServer: 'https://mempool.space/api/v1/fees/recommended',
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
  displayName: 'Bitcoin',
  pluginId: 'bitcoin',
  denominations: [
    { name: 'BTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' },
    { name: 'sats', multiplier: '1', symbol: 's' }
  ],
  walletType: 'wallet:bitcoin',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrum-bc-az-eusa.airbitz.co:50001',
      'electrum://electrum.hsmiths.com:8080',
      'electrum://node.arihanc.com:50001',
      'electrum://electrum.petrkr.net:50001',
      'electrum://electrum2.everynothing.net:50001',
      'electrum://currentlane.lovebitco.in:50001',
      'electrum://electrum.hsmiths.com:50001',
      'electrum://electrumx.westeurope.cloudapp.azure.com:50001'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin/transaction/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoin-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoin-logo-solo-64.png`
}

export const bitcoin = { bcoinInfo, engineInfo, currencyInfo }
