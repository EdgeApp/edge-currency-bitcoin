// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'bitcoingoldtestnet',
  magic: 0x0709110b,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  keyPrefix: {
    privkey: 0xef,
    xpubkey: 0x043587cf,
    xprivkey: 0x04358394,
    xpubkey58: 'tpub',
    xprivkey58: 'tprv',
    coinType: 156
  },
  addressPrefix: {
    pubkeyhash: 0x6f,
    scripthash: 0xc4,
    witnesspubkeyhash: 0x03,
    witnessscripthash: 0x28,
    bech32: 'tb'
  },
  replayProtection: {
    SIGHASH_FORKID: 64,
    forcedMinVersion: 1,
    forkId: 79
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcoingold',
  currencyCode: 'TBTG',
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  earnComFeeInfoServer: '',
  customFeeSettings: ['satPerByte'],
  minRelayFee: '1',
  simpleFeeSettings: {
    highFee: '200',
    lowFee: '10',
    standardFeeLow: '15',
    standardFeeHigh: '140',
    standardFeeLowAmount: '17320',
    standardFeeHighAmount: '86700000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'TBTG',
  displayName: 'Bitcoin Gold Testnet',
  pluginId: 'bitcoingoldtestnet',
  denominations: [
    { name: 'TBTG', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBTG', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],
  walletType: 'wallet:bitcoingold-testnet',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://test-node1.bitcoingold.org:50001',
      'electrums://test-node1.bitcoingold.org:50002',
      'electrum://test-node2.bitcoingold.org :50001',
      'electrums://test-node2.bitcoingold.org :50002',
      'electrum://test-node3.bitcoingold.org:50001',
      'electrums://test-node3.bitcoingold.org:50002',
      'electrum://test-node1.btcgpu.org:50001',
      'electrums://test-node1.btcgpu.org:50002',
      'electrum://test-node2.btcgpu.org:50001',
      'electrums://test-node2.btcgpu.org:50002',
      'electrum://test-node3.btcgpu.org:50001',
      'electrums://test-node3.btcgpu.org:50002'
    ],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://test-explorer.bitcoingold.org/insight/block/%s',
  addressExplorer: 'https://test-explorer.bitcoingold.org/insight/address/%s',
  transactionExplorer: 'https://test-explorer.bitcoingold.org/insight/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoingold-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoingold-logo-solo-64.png`
}

export const bitcoingoldTestnet = { bcoinInfo, engineInfo, currencyInfo }
