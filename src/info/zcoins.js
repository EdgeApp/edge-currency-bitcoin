// @flow

import { asArray, asBoolean, asNumber, asObject, asString } from 'cleaners'
import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import { CurrencyEngineExtension } from '../engine/currencyEngineExtension'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'
import { ZcoinEngineExtension } from './sigma/zcoinEngineExtension'

export const SIGMA_ENCRYPTED_FILE = 'mint.json'
export const RESTORE_FILE = 'restore.json'
export const OP_SIGMA_MINT = 'c3'
export const OP_SIGMA_SPEND = 'c4'
export const BIP44_MINT_INDEX = '2'

export const SIGMA_COIN = 100000000

export const DENOMINATIONS = [
  '5000000',
  '10000000',
  '50000000',
  '100000000',
  '1000000000',
  '2500000000',
  '10000000000'
]

export const asPrivateCoin = asObject({
  value: asNumber,
  index: asNumber,
  commitment: asString,
  serialNumber: asString,
  groupId: asNumber,
  isSpend: asBoolean,
  spendTxId: asString
})

export const asPrivateCoinArray = asArray(asPrivateCoin)

export type PrivateCoin = $Call<typeof asPrivateCoin>

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'zcoins',
  magic: 0xd9b4bef9,
  formats: ['bip44', 'bip32'],
  keyPrefix: {
    privkey: 0xd2,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 136
  },
  addressPrefix: {
    pubkeyhash: 0x52,
    scripthash: 0x7
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'zcoins',
  currencyCode: 'XZC',
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000'
  },
  timestampFromHeader(header: Buffer): number {
    if (header.length < 80) {
      throw new Error(`Cannot interpret block header ${header.toString('hex')}`)
    }
    return header.readUInt32LE(4 + 32 + 32)
  },
  createCurrencyEngineExtension(): CurrencyEngineExtension {
    return new ZcoinEngineExtension()
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'XZC',
  displayName: 'Anonymous Zcoin',
  pluginId: 'zcoins',
  denominations: [
    { name: 'XZC', multiplier: '100000000', symbol: 'Ƶ' },
    { name: 'mXZC', multiplier: '100000', symbol: 'mƵ' }
  ],
  walletType: 'wallet:zcoins',
  requiredConfirmations: 6,

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://51.15.82.184:50001',
      'electrum://45.63.92.224:50001',
      'electrum://47.75.76.176:50001',
      'electrums://51.15.82.184:50002',
      'electrums://45.63.92.224:50002',
      'electrums://47.75.76.176:50002'
    ],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://insight.zcoin.io/address/%s',
  blockExplorer: 'https://insight.zcoin.io/block/%s',
  transactionExplorer: 'https://insight.zcoin.io/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/zcoin-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/zcoin-logo-solo-64.png`
}

export const zcoins = { bcoinInfo, engineInfo, currencyInfo }
