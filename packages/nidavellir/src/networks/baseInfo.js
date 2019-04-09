// @flow

import { type NetworkInfo } from '../../types/core.js'
import { base } from '../utils/base.js'
import { hash256 } from '../utils/hash.js'

export const main: NetworkInfo = {
  coinType: 0,
  bips: [44, 32],
  forks: [],
  replayProtection: {
    forkSighash: 0x00,
    forcedMinVersion: 0,
    forkId: 0
  },
  WIFConfig: {
    prefixes: [0x80],
    formatter: base['58'].check
  },
  HDKeyConfig: {
    prefixes: {
      '44': {
        pubkey: [0x0488b21e],
        privkey: [0x0488ade4]
      }
    },
    formatter: base['58'].check
  },
  addressConfig: {
    prefixes: [0x80],
    formatter: base['58'].check
  },
  txHashConfig: {
    formatter: hash256
  },
  sigHashConfig: {
    formatter: (str: Buffer) => Buffer.from(hash256(str.toString('hex')), 'hex')
  }
}
