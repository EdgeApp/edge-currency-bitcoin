// @flow
import type { HDSettings } from '../bcoinUtils/types.js'

const bips: HDSettings = {
  '32': {
    keyType: 'privateKey',
    scriptType: 'P2PKH-AIRBITZ',
    children: {
      '0': { keyType: 'publicKey' }
    }
  },
  '44': {
    keyType: 'privateKey',
    scriptType: 'P2PKH',
    children: {
      '0': { keyType: 'publicKey' },
      '1': { keyType: 'publicKey' }
    }
  },
  '49': {
    keyType: 'privateKey',
    scriptType: 'P2WPKH-P2SH',
    children: {
      '0': { keyType: 'publicKey' },
      '1': { keyType: 'publicKey' }
    }
  },
  '84': {
    keyType: 'privateKey',
    scriptType: 'P2WPKH',
    children: {
      '0': { keyType: 'publicKey' },
      '1': { keyType: 'publicKey' }
    }
  }
}

const standardPath = (bip: number, defaultCoinType: number) => (
  account: number,
  coinType: number
) => `${bip}'/${coinType >= 0 ? coinType : defaultCoinType}'/${account}'`

export const getHDSettings = (
  supportedBips: Array<number>,
  defaultCoinType: number
): HDSettings => {
  const settings = {}
  for (const bip of supportedBips) {
    const getPath = bip === 32 ? () => '0' : standardPath(bip, defaultCoinType)
    settings[`${bip}`] = { ...bips[`${bip}`], getPath }
  }
  return settings
}
