// @flow

import type { NetworkInfo } from '../../types/core.js'
import { base } from '../utils/base.js'
import { hash256 } from '../utils/hash.js'

export const main: NetworkInfo = {
  magic: 0xd9b4bef9,
  bips: [44, 32],
  forks: [],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 0
  },
  addressPrefix: {},
  legacyAddressPrefix: {},
  replayProtection: {
    forkSighash: 0x00,
    forcedMinVersion: 0,
    forkId: 0
  },
  serializers: {
    address: base['58'].check,
    wif: base['58'].check,
    xkey: base['58'].check,
    txHash: hash256,
    sigHash: (str: Buffer) => Buffer.from(hash256(str.toString('hex')), 'hex')
  }
}
