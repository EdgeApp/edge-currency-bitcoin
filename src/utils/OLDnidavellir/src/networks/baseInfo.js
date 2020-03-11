// @flow

import { type NetworkInfo, type HDPathsSetting } from '../../types/core'
import { base } from '../utils/base.js'
import { hash256 } from '../utils/hash.js'

// TODO - Actually get bech32
const bech32 = base['58'].check
const base58 = base['58'].check

const HDPaths: HDPathsSetting = {
  '32': {
    scriptType: 'P2PKH',
    xpriv: { prefixHex: 0x0488ade4, prefixStr: 'xprv', decoder: { ...base58, base: 'xprv' } },
    xpub: { prefixHex: 0x0488b21e, prefixStr: 'xpub', decoder: { ...base58, base: 'xpub' } },
    address: { prefixHex: 0x80, prefixStr: '1', decoder: { ...base58, base: '1' } }
  },
  '44': {
    scriptType: 'P2PKH',
    xpriv: { prefixHex: 0x0488ade4, prefixStr: 'xprv', decoder: { ...base58, base: 'xprv' } },
    xpub: { prefixHex: 0x0488b21e, prefixStr: 'xpub', decoder: { ...base58, base: 'xpub' } },
    address: { prefixHex: 0x80, prefixStr: '1', decoder: { ...base58, base: '1' } }
  },
  '49': {
    scriptType: 'P2WPKH-P2SH',
    xpriv: { prefixHex: 0x049d7878, prefixStr: 'yprv', decoder: base58 },
    xpub: { prefixHex: 0x049d7cb2, prefixStr: 'ypub', decoder: base58 },
    address: { prefixHex: 0x05, prefixStr: '3', decoder: base58 }
  },
  '84': {
    scriptType: 'P2WPKH',
    xpriv: { prefixHex: 0x04b2430c, prefixStr: 'zprv', decoder: base58 },
    xpub: { prefixHex: 0x04b24746, prefixStr: 'zpub', decoder: base58 },
    address: { prefixHex: -1, prefixStr: 'bc', decoder: bech32 }
  }
}

export const main: NetworkInfo = {
  coinType: 0,
  wif: {
    prefixHex: 0x80,
    prefixStr: '1',
    decoder: base['58'].check
  },
  HDPaths,
  DefaultHDPath: 44,
  txHash: hash256,
  sigHash: (str: Buffer) => Buffer.from(hash256(str.toString('hex')), 'hex')
}
