// @flow
import { type HDPath } from '../../types/hd'
import * as Path from './path.js'
import { HARDENED } from './common.js'

export const Bip32 = {
  toString: ([ account, chain, index ]: HDPath): string => {
    if (chain !== 0 && chain !== 1) throw new Error('Unknown chain')
    return 'm/' + Path.toString([ account, chain, index ])
  },
  fromString: (path: string): HDPath => {
    if (path[0] !== 'm') throw new Error('Wrong path header')
    const pathArr = Path.fromString(path)
    if (pathArr.length !== 3) throw new Error('Unknown path depth')
    const [ account, chain, index ] = pathArr
    if (chain !== 0 && chain !== 1) throw new Error('Unknown chain')
    return [ account, index, chain ]
  }
}

export const Bip43 = {
  toString: ([ purpose, ...rest ]: HDPath): string => {
    if (purpose < HARDENED) purpose += HARDENED
    return 'm/' + Path.toString([ purpose, ...rest ])
  },
  fromString: (path: string): HDPath => {
    if (path[0] !== 'm') throw new Error('Wrong path header')
    const [ purpose, ...rest ] = Path.fromString(path)
    if (!purpose || purpose < HARDENED) throw new Error('Purpose has to be hardened')
    return [ purpose, ...rest ]
  }
}

const createBip44StylePath = (bipNum: number) => ({
  toString: ([ purpose, coinType, account, change, index ]: HDPath): string => {
    if (purpose < HARDENED) purpose += HARDENED
    if (purpose !== bipNum + HARDENED) throw new Error('Wrong purpose number')
    if (change !== 0 && change !== 1) throw new Error('Unknown chain')
    if (coinType < HARDENED) coinType += HARDENED
    if (account < HARDENED) account += HARDENED
    if (index >= HARDENED) throw new Error(`Index should be smaller then ${HARDENED}`)
    return 'm/' + Bip43.toString([ purpose, coinType, account, change, index ])
  },
  fromString: (path: string): HDPath => {
    const pathArr = Bip43.fromString(path)
    if (pathArr.length !== 5) throw new Error('Unknown path depth')
    const [ purpose, coinType, account, change, index ] = pathArr
    if (purpose !== bipNum + HARDENED) throw new Error('Wrong purpose number')
    if (coinType < HARDENED) throw new Error('Coin Type has to be hardened')
    if (account < HARDENED) throw new Error('Account has to be hardened')
    if (change !== 0 && change !== 1) throw new Error('Unknown chain')
    if (index >= HARDENED) throw new Error('Index should not be hardened')
    return [ purpose, coinType, account, change, index ]
  }
})

export const Bip44 = createBip44StylePath(44)
export const Bip49 = createBip44StylePath(49)
export const Bip84 = createBip44StylePath(84)
