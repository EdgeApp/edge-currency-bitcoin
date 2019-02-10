// @flow

import { Base, Crypto } from '@perian/core-utils'

import type { NetworkInfo } from './types.js'

const bs58check = Base.base['58'].check

const main: NetworkInfo = {
  magic: 0xd9b4bef9,
  supportedBips: [44, 32],
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
    address: bs58check,
    wif: bs58check,
    xkey: bs58check,
    txHash: Crypto.hash256,
    sigHash: (str: Buffer) =>
      Buffer.from(Crypto.hash256(str.toString('hex')), 'hex')
  }
}

const testnet: NetworkInfo = {
  ...main,
  magic: 0x0709110b,
  keyPrefix: {
    privkey: 0xef,
    xpubkey: 0x043587cf,
    xprivkey: 0x04358394,
    xpubkey58: 'tpub',
    xprivkey58: 'tprv',
    coinType: 1
  }
}

export { main, testnet }
export * from './types.js'
