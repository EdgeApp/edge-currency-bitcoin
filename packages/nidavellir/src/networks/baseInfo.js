// @flow

import { type NetworkInfo } from '../../types/core.js'
import { bip32, bip44 } from '../hd/paths.js'
import { base } from '../utils/base.js'
import { hash256 } from '../utils/hash.js'

export const main: NetworkInfo = {
  coinType: 0,
  wif: {
    prefix: 0x80,
    stringPrefix: '1',
    decoder: base['58'].check
  },
  supportedHDPaths: [bip44, bip32],
  txHash: hash256,
  sigHash: (str: Buffer) => Buffer.from(hash256(str.toString('hex')), 'hex'),
  forks: [],
  replayProtection: {
    forkSighash: 0x00,
    forcedMinVersion: 0,
    forkId: 0
  }
}
