// @flow
import { bip84, bip49 } from '../hd/paths.js'

const forks = ['bitcoincash', 'bitcoingold', 'bitcoindiamond']

export const main = { supportedHDPaths: [ bip84, bip49 ], forks }

export const testnet = {
  coinType: 1,
  wif: 0xef,
  supportedHDPaths: [
    {
      purpose: 32,
      xpriv: 0x04358394,
      xpub: 0x043587cf,
      address: 0x6f
    },
    {
      purpose: 44,
      xpriv: 0x04358394,
      xpub: 0x043587cf,
      address: 0x6f
    },
    {
      purpose: 49,
      xpriv: 0x04358394,
      xpub: 0x043587cf,
      address: 0xc4
    },
    {
      purpose: 84,
      xpriv: 0x04358394,
      xpub: 0x043587cf,
      address: 'tb'
    }
  ]
}
