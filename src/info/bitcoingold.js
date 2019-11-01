// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'bitcoingold',
  magic: 0x0709110b,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 156
  },
  addressPrefix: {
    pubkeyhash: 0x26,
    scripthash: 0x17,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'btg'
  },
  replayProtection: {
    SIGHASH_FORKID: 64,
    forcedMinVersion: 1,
    forkId: 79
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcoingold',
  currencyCode: 'BTG',
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  feeInfoServer: '',
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '200',
    lowFee: '10',
    standardFeeLow: '15',
    standardFeeHigh: '140',
    standardFeeLowAmount: '17320',
    standardFeeHighAmount: '86700000'
  },
  timestampFromHeader(header: Buffer, height: number): number {
    if (height < 491407 || header.readUInt32LE(0) & 0x04000000) {
      if (header.length !== 80) {
        throw new Error(
          `Cannot interpret block header ${header.toString('hex')}`
        )
      }
      return header.readUInt32LE(4 + 32 + 32)
    } else {
      if (header.length < 80 + 32 + 32) {
        throw new Error(
          `Cannot interpret block header ${header.toString('hex')}`
        )
      }
      return header.readUInt32LE(4 + 32 + 32 + 32)
    }
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:

  currencyCode: 'BTG',
  displayName: 'Bitcoin Gold',
  pluginName: 'bitcoingold',
  denominations: [
    { name: 'BTG', multiplier: '100000000', symbol: '₿' },
    { name: 'mBTG', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],
  walletType: 'wallet:bitcoingold',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrumx-eu.bitcoingold.org:50001',
      'electrums://electrumx-eu.bitcoingold.org:50002',
      'electrum://electrumx-us.bitcoingold.org:50001',
      'electrums://electrumx-us.bitcoingold.org:50002',
      'electrum://electrumx-eu.btcgpu.org:50001',
      'electrums://electrumx-eu.btcgpu.org:50002',
      'electrum://electrumx-us.btcgpu.org:50001',
      'electrums://electrumx-us.btcgpu.org:50002'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://explorer.bitcoingold.org/insight/block/%s',
  addressExplorer: 'https://explorer.bitcoingold.org/insight/address/%s',
  transactionExplorer: 'https://explorer.bitcoingold.org/insight/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoingold-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoingold-logo-solo-64.png`
}

export const bitcoingold = { bcoinInfo, engineInfo, currencyInfo }
