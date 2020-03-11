// @flow

export const main = { DefaultHDPath: 84 }

export const testnet = {
  coinType: 1,
  wif: 0xef,
  HDPaths: {
    '32': {
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
    '44': {
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
    '49': {
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
    '84': {
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
  }
}
