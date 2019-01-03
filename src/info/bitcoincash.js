// @flow
import type { EdgeCurrencyInfo } from '../utils/flowTypes.js'
import type { EngineCurrencyInfo } from '../engine/currencyEngine.js'
import type { BcoinCurrencyInfo } from '../utils/bcoinExtender/bcoinExtender.js'
import { imageServerUrl } from './constants.js'
import { hexToVarByte } from '../utils/utils.js'
import { script } from 'bcoin'

const scriptProto = script.prototype
const getPubkey = scriptProto.getPubkey
scriptProto.getPubkey = function (minimal: boolean) {
  if (this.code.length === 6) {
    const size = this.getLength(4)

    if (
      (size === 33 || size === 65) &&
      this.getOp(5) === parseInt(OP_CHECKSIG, 16)
    ) {
      return this.getData(4)
    }
  }

  return getPubkey.call(this, minimal)
}
const OP_CHECKDATASIGVERIFY = 'bb'
const OP_CHECKDATASIG = 'ba'
const OP_CHECKSIG = 'ac'
const SIGNATURE =
  '30440220256c12175e809381f97637933ed6ab97737d263eaaebca6add21bced67fd12a402205ce29ecc1369d6fc1b51977ed38faaf41119e3be1d7edfafd7cfaf0b6061bd07'
const MESSAGE = ''
const PUBKEY =
  '038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508'
const cds = (sig: string, msg: string, pubKey: string, hdKey: any) => {
  const cdsSuffix = `${hexToVarByte(
    hdKey ? hdKey.publicKey.toString('hex') : ''
  )}${OP_CHECKSIG}`
  const cdsPrefix = `0x${hexToVarByte(sig)}${hexToVarByte(msg)}${hexToVarByte(
    pubKey
  )}`
  return [cdsPrefix, cdsSuffix]
}

const bcoinInfo: BcoinCurrencyInfo = {
  type: 'bitcoincash',
  magic: 0xd9b4bef9,
  supportedBips: ['bip44', 'bip32'],
  forks: ['bitcoincashsv'],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 145
  },
  addressPrefix: {
    pubkeyhash: 0x00,
    scripthash: 0x05,
    cashAddress: 'bitcoincash'
  },
  replayProtection: {
    SIGHASH_FORKID: 0x40,
    forcedMinVersion: 1,
    forkId: 0
  },
  scriptTemplates: {
    replayProtection: (hdKey: any) =>
      cds(SIGNATURE, MESSAGE, PUBKEY, hdKey).join(OP_CHECKDATASIGVERIFY),
    checkdatasig: (hdKey: any) => (
      sig: string = '',
      msg: string = '',
      pubKey: string = ''
    ) => cds(sig, msg, pubKey, hdKey).join(OP_CHECKDATASIG),
    checkdatasigverify: (hdKey: any) => (
      sig: string = '',
      msg: string = '',
      pubKey: string = ''
    ) => cds(sig, msg, pubKey, hdKey).join(OP_CHECKDATASIGVERIFY)
  }
}

const engineInfo: EngineCurrencyInfo = {
  network: 'bitcoincash',
  currencyCode: 'BCH',
  gapLimit: 10,
  maxFee: 1000000,
  defaultFee: 10000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '20',
    lowFee: '3',
    standardFeeLow: '5',
    standardFeeHigh: '10',
    standardFeeLowAmount: '1000000',
    standardFeeHighAmount: '65000000'
  }
}

const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'BCH',
  currencyName: 'Bitcoin Cash',
  pluginName: 'bitcoincash',
  denominations: [
    { name: 'BCH', multiplier: '100000000', symbol: '₿' },
    { name: 'mBCH', multiplier: '100000', symbol: 'm₿' },
    { name: 'cash', multiplier: '100', symbol: 'ƀ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://abc1.hsmiths.com:60001',
      'electrums://electroncash.bitcoinplug.com:50002',
      'electrum://electroncash.bitcoinplug.com:50001',
      'electrums://bch.tedy.pw:50002',
      'electrum://bch.tedy.pw:50001',
      'electrums://electroncash.cascharia.com:50002',
      'electrums://14.3.38.179:50002',
      'electrum://14.3.38.179:50001',
      'electrums://bch.arihanc.com:52002',
      'electrum://bch.arihanc.com:52001',
      'electrums://electron-cash.dragon.zone:50002',
      'electrum://electron-cash.dragon.zone:50001',
      'electrum://bch.stitthappens.com:50001',
      'electrum://abc.vom-stausee.de:52001',
      'electrums://electron.coinucopia.io:50002',
      'electrum://electron.coinucopia.io:50001',
      'electrums://elecash.bcc.nummi.it:50012',
      'electrum://electron.jns.im:50001',
      'electrums://electrum.leblancnet.us:50012',
      'electrum://electrum.leblancnet.us:50011',
      'electrums://bch.curalle.ovh:50002',
      'electrums://electron.jns.im:50002',
      'electrums://abc.vom-stausee.de:52002',
      'electrums://abc1.hsmiths.com:60002',
      'electrum://electrumx-cash.itmettke.de:50001',
      'electrums://electrumx-cash.itmettke.de:50002',
      'electrums://electrumx-bch.adminsehow.com:50012',
      'electrum://electrumx-bch.adminsehow.com:50011'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin-cash/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin-cash/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin-cash/transaction/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoincash-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoincash-logo-solo-64.png`
}

export const bitcoincash = { bcoinInfo, engineInfo, currencyInfo }
