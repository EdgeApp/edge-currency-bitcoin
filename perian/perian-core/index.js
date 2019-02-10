// @flow

import * as Derive from './src/bip32/derive.js'
import * as ExtendedKey from './src/bip32/extendedKey.js'
import * as HDKey from './src/bip44/hdKey.js'
import * as Paths from './src/bip44/paths.js'
import * as KeyPair from './src/commons/keyPair.js'
import * as Network from './src/commons/network.js'

const Commons = { KeyPair, Network }
const Bip32 = { Derive, ExtendedKey }
const Bip44 = { Paths, HDKey }

export { Commons, Bip32, Bip44 }
export * from './types/types.js'
