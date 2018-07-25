// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'bitcointestnet',
  magic: 0x0709110b,
  formats: ['bip84', 'bip49', 'bip44', 'bip32'],
  forks: ['bitcoincash', 'bitcoingold', 'bitcoindiamond'],
  keyPrefix: {
    privkey: 0xef,
    xpubkey: 0x043587cf,
    xprivkey: 0x04358394,
    xpubkey58: 'tpub',
    xprivkey58: 'tprv',
    coinType: 1
  },
  addressPrefix: {
    pubkeyhash: 0x6f,
    scripthash: 0xc4,
    witnesspubkeyhash: 0x03,
    witnessscripthash: 0x28,
    bech32: 'tb'
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcointestnet',
  currencyCode: 'BTC',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  feeInfoServer: '',
  infoServer: '',
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '30',
    lowFee: '5',
    standardFeeLow: '10',
    standardFeeHigh: '15',
    standardFeeLowAmount: '17320',
    standardFeeHighAmount: '86700000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'BTC',
  currencyName: 'BitcoinTestnet',
  pluginName: 'bitcointestnet',
  denominations: [
    { name: 'BTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!! - About to be deprecated - !!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  walletTypes: [
    'wallet:bitcoin-bip84-testnet',
    'wallet:bitcoin-bip49-testnet',
    'wallet:bitcoin-bip44-testnet',
    'wallet:bitcoin-testnet'
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://testnet.hsmiths.com:53011',
      'electrum://testnet1.bauerj.eu:50001',
      'electrum://electrum.akinbo.org:51001',
      'electrum://testnetnode.arihanc.com:51001',
      'electrum://electrum.akinbo.org:51001',
      'electrum://testnet1.bauerj.eu:50001',
      'electrum://testnet.qtornado.com:51001',
      'electrum://testnet.hsmiths.com:53011',
      'electrums://testnet.hsmiths.com:53012',
      'electrums://testnet.qtornado.com:51002',
      'electrums://electrum.akinbo.org:51002',
      'electrum://testnetnode.arihanc.com:51001'
    ],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://live.blockcypher.com/btc-testnet/block/%s',
  addressExplorer: 'https://live.blockcypher.com/btc-testnet/address/%s',
  transactionExplorer: 'https://live.blockcypher.com/btc-testnet/tx/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoin-logo-color-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoin-logo-grey-64.png`
}

export const bitcoinTestnet = { bcoinInfo, engineInfo, currencyInfo }
