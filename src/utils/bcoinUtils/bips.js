// @flow
import type { BranchesSettings } from './types.js'
import { networks } from 'bcoin'

const createStandardPath = (bip: number) => (
  account: number,
  coinType: number,
  network: string
) =>
  bip === 32
    ? 'm/0'
    : `m/${bip}'/${
      coinType >= 0 ? coinType : networks[network].keyPrefix.coinType
    }'/${account}'`

export const branchesSettings: BranchesSettings = {
  bip32: {
    path: createStandardPath(32),
    branchNumber: 32,
    nested: false,
    witness: false,
    scriptType: 'P2PKH',
    addresses: [
      { index: 0, purpose: 'receive' },
      { index: 1, purpose: 'change' }
    ]
  },
  bip44: {
    path: createStandardPath(44),
    branchNumber: 44,
    nested: false,
    witness: false,
    scriptType: 'P2PKH',
    addresses: [
      { index: 0, purpose: 'receive' },
      { index: 1, purpose: 'change' }
    ]
  },
  bip49: {
    path: createStandardPath(49),
    branchNumber: 49,
    nested: true,
    witness: true,
    scriptType: 'P2WPKH-P2SH',
    addresses: [
      { index: 0, purpose: 'receive' },
      { index: 1, purpose: 'change' }
    ]
  },
  bip84: {
    path: createStandardPath(84),
    branchNumber: 84,
    nested: false,
    witness: true,
    scriptType: 'P2WPKH',
    addresses: [
      { index: 0, purpose: 'receive' },
      { index: 1, purpose: 'change' }
    ]
  }
}
