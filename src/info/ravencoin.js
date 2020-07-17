// @flow

import { type EdgeCurrencyInfo } from 'edge-core-js/types'

import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'ravencoin',
  magic: 0xd9b4bef9, // ?
  formats: ['bip44', 'bip32'],
  keyPrefix: {
    privkey: 0x80, // done
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 175 // https://github.com/satoshilabs/slips/blob/master/slip-0044.md
  },
  addressPrefix: {
    pubkeyhash: 0x3c, // done
    scripthash: 0x7a // done
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'ravencoin',
  currencyCode: 'RVN',
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
  timestampFromHeader(header: Buffer, height: number): number {
    if (height < 1219736) {
      if (header.length !== 80) {
        throw new Error(
          `Cannot interpret block header ${header.toString('hex')}`
        )
      }
    } else {
      if (header.length !== 120) {
        throw new Error(
          `Cannot interpret block header ${header.toString('hex')}`
        )
      }
    }
    return header.readUInt32LE(4 + 32 + 32)
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'RVN',
  displayName: 'Ravencoin',
  pluginId: 'ravencoin',
  denominations: [{ name: 'RVN', multiplier: '100000000', symbol: 'R' }],
  walletType: 'wallet:ravencoin',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: ['electrum://rvn.satoshi.org.uk:50001'],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://ravencoin.network/address/%s',
  blockExplorer: 'https://ravencoin.network/block/%s',
  transactionExplorer: 'https://ravencoin.network/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/ravencoin-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/ravencoin-logo-solo-64.png`
}

export const ravencoin = { bcoinInfo, engineInfo, currencyInfo }
