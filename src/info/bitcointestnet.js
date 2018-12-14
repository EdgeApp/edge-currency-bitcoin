// @flow
import type { EdgeCurrencyInfo } from 'edge-core-js'
import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'
import { crypto } from 'bcoin'

const hash256 = (rawTx: string) => {
  const buf = Buffer.from(rawTx, 'hex')
  return crypto.digest.hash256(buf)
}

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'bitcointestnet',
  magic: 0x0709110b,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
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
  },
  serializers: {
    txHash: (rawTx: string) => hash256(rawTx).toString('hex')
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcointestnet',
  currencyCode: 'TBTC',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  feeInfoServer: '',
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
  currencyCode: 'TBTC',
  currencyName: 'Bitcoin Testnet',
  pluginName: 'bitcointestnet',
  denominations: [
    { name: 'TBTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!! - About to be deprecated - !!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  walletTypes: [
    'wallet:bitcoin-testnet',
    'wallet:bitcoin-bip84-testnet',
    'wallet:bitcoin-bip49-testnet',
    'wallet:bitcoin-bip44-testnet'
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
  symbolImage: `${imageServerUrl}/bitcoin-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoin-logo-solo-64.png`
}

export const bitcoinTestnet = { bcoinInfo, engineInfo, currencyInfo }
