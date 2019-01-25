// @flow
import type { HDPaths } from './types.js'

const bip44Path = (bip: number) => (account: number, coinType: number) =>
  `${bip}'/${coinType}'/${account}'`

export const defaultPaths: HDPaths = {
  '32': {
    scriptType: 'P2PKH-AIRBITZ',
    path: () => '0',
    children: {
      '0': { chain: 'external' }
    }
  },
  '44': {
    scriptType: 'P2PKH',
    path: bip44Path(44),
    children: {
      '0': { chain: 'external' },
      '1': { chain: 'internal' }
    }
  },
  '49': {
    scriptType: 'P2WPKH-P2SH',
    path: bip44Path(49),
    children: {
      '0': { chain: 'external' },
      '1': { chain: 'internal' }
    }
  },
  '84': {
    scriptType: 'P2WPKH',
    path: bip44Path(88),
    children: {
      '0': { chain: 'external' },
      '1': { chain: 'internal' }
    }
  }
}
