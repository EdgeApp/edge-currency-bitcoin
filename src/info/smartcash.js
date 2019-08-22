// @flow

import { Buffer } from 'buffer'

import { crypto, utils } from 'bcoin'
import bs58sc from 'bs58smartcheck'
import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const base58 = {
  decode: (address: string) => {
    const payload = bs58sc.decode(address)
    const bw = new utils.StaticWriter(payload.length + 4)
    bw.writeBytes(payload)
    bw.writeChecksum()
    return utils.base58.encode(bw.render())
  },
  encode: (address: string) => {
    const payload = utils.base58.decode(address)
    return bs58sc.encode(payload.slice(0, -4))
  }
}

const sha256 = (rawTx: string) => {
  const buf = Buffer.from(rawTx, 'hex')
  return crypto.digest.sha256(buf)
}

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'smartcash',
  magic: 0x5ca1ab1e,
  formats: ['bip44', 'bip32'],
  keyPrefix: {
    privkey: 0xbf,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 224
  },
  addressPrefix: {
    pubkeyhash: 0x3f,
    scripthash: 0x12
  },
  serializers: {
    address: base58,
    wif: base58,
    txHash: (rawTx: string) => sha256(rawTx).toString('hex'),
    signatureHash: sha256
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'smartcash',
  currencyCode: 'SMART',
  gapLimit: 10,
  defaultFee: 100000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '1500',
    lowFee: '200',
    standardFeeLow: '500',
    standardFeeHigh: '1000',
    standardFeeLowAmount: '1732000',
    standardFeeHighAmount: '86700000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'SMART',
  displayName: 'SmartCash',
  pluginName: 'smartcash',
  denominations: [
    { name: 'SMART', multiplier: '100000000', symbol: 'S' },
    { name: 'mSMART', multiplier: '100000', symbol: 'mS' }
  ],
  walletType: 'wallet:smartcash',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrum1.smartcash.cc:50001',
      'electrum://electrum2.smartcash.cc:50001',
      'electrum://electrum3.smartcash.cc:50001',
      'electrum://electrum4.smartcash.cc:50001',
      'electrums://electrum1.smartcash.cc:50002',
      'electrums://electrum2.smartcash.cc:50002',
      'electrums://electrum3.smartcash.cc:50002',
      'electrums://electrum4.smartcash.cc:50002'
    ],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://insight.smartcash.cc/address/%s',
  blockExplorer: 'https://insight.smartcash.cc/block/%s',
  transactionExplorer: 'https://insight.smartcash.cc/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/smartcash-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/smartcash-logo-solo-64.png`
}

export const smartcash = { bcoinInfo, engineInfo, currencyInfo }
