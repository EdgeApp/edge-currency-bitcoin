// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'
import crypto from 'crypto'
import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'
import { utils } from 'bcoin'

const base58 = {
  decode: function(address: string) {
    // console.log('1 addres: ', address)
    const buf = utils.base58.decode(address)
    // console.log('2 buf: ', buf)
    if (buf.length < 4) {
      throw new Error("invalid input: too short")
    }
    const data = buf.slice(0, -4)
    // console.log('3 data: ', data)
    const csum = buf.slice(-4)
    // console.log('4 csum: ', csum)
    const hash = doubleblake256(data)
    // console.log('5 hash: ', hash)
    const hash4 = hash.slice(0, 4)
    // console.log('6 hash4: ', hash4)
    if (csum.toString('hex') !== hash4.toString('hex')) {
      throw new Error("checksum mismatch (found " + csum.toString('hex')
        + ", want " + hash4.toString('hex') + ")")
    }

    const bw = new utils.StaticWriter(data.length + 4)
    // console.log('7 bw: ', bw)
    bw.writeBytes(data)
    // console.log('8 bw: ', bw)
    bw.writeChecksum()
    // console.log('9 bw: ', bw)
    const output = utils.base58.encode(bw.render())
    // console.log('10 output: ', output)
    return output
  },
  encode: function(address: string) {
    const buf = utils.base58.decode(address)
    const bw = new utils.StaticWriter(buf.length + 4)
    const hash = doubleblake256(buf)
    bw.writeBytes(buf)
    bw.writeBytes(hash)
    const result = utils.base58.encode(bw.render())
    return result
  }
}

const blake256 = data => crypto.createHash('blake256').update(data).digest()
const doubleblake256 = data => blake256(blake256(data))

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'decred',
  magic: 0xd9b400f9,
  formats: ['bip44', 'bip32'],
  forks: [],
  keyPrefix: {
    privkey: 0x22de,
    xpubkey: 0x02fda926,
    xprivkey: 0x02fda4e8,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 42
  },
  addressPrefix: {
    pubkeyhash: 0x3f,
    scripthash: 0x1a
  },
  serializers: {
    address: base58,
    wif: base58,
    txHash: (rawTx: string) => blake256(rawTx).toString('hex'),
    signatureHash: blake256
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'decred',
  currencyCode: 'DCR',
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
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'DCR',
  displayName: 'Decred',
  pluginName: 'decred',
  denominations: [{ name: 'DCR', multiplier: '100000000', symbol: 'DCR' }],
  walletType: 'wallet:decred',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      '209.250.246.201:9108',
      '88.198.53.172:9108',
      '52.62.64.145:9108',
      '138.68.238.246:9108',
      '209.126.111.161:9108',
      '107.179.246.222:9108',
      '13.127.22.242:9108',
      '104.37.172.184:9108',
      '80.211.221.61:9108',
      '167.99.193.132:9108',
      '50.3.68.112:9108'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://mainnet.decred.org/block/%s',
  addressExplorer: 'https://mainnet.decred.org/address/%s',
  transactionExplorer: 'https://mainnet.decred.org/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/decred-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/decred-logo-solo-64.png`
}

export const decred = { bcoinInfo, engineInfo, currencyInfo }
