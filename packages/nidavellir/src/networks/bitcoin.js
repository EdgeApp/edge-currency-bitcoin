// @flow
import { bip49, bip84 } from '../hd/paths.js'

const forks = ['bitcoincash', 'bitcoingold', 'bitcoindiamond']

export const main = { supportedHDPaths: [bip84, bip49], forks }

export const testnet = {
  coinType: 1,
  wif: 0xef,
  supportedHDPaths: [
    {
      purpose: 32,
      xpriv: {
        prefix: 0x04358394,
        stringPrefix: 'tprv'
      },
      xpub: {
        prefix: 0x043587cf,
        stringPrefix: 'tpub'
      },
      address: 0x6f
    },
    {
      purpose: 44,
      xpriv: {
        prefix: 0x04358394,
        stringPrefix: 'tprv'
      },
      xpub: {
        prefix: 0x043587cf,
        stringPrefix: 'tpub'
      },
      address: 0x6f
    },
    {
      purpose: 49,
      xpriv: {
        prefix: 0x04358394,
        stringPrefix: 'tprv'
      },
      xpub: {
        prefix: 0x043587cf,
        stringPrefix: 'tpub'
      },
      address: 0xc4
    },
    {
      purpose: 84,
      xpriv: {
        prefix: 0x04358394,
        stringPrefix: 'tprv'
      },
      xpub: {
        prefix: 0x043587cf,
        stringPrefix: 'tpub'
      },
      address: 'tb'
    }
  ]
}
