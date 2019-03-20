// @flow

import * as Derive from './src/bip32/derive.js'
import * as ExtendedKey from './src/bip32/extendedKey.js'
import * as HDKey from './src/bip32/hdKey.js'
import * as Paths from './src/bip44/paths.js'
import * as KeyPair from './src/core/keyPair.js'
import * as NetworkInfo from './src/core/networkInfo.js'
import * as Base from './src/utils/base.js'
import * as Formatter from './src/utils/formatter.js'
import * as Hash from './src/utils/hash.js'
import * as Require from './src/utils/require.js'
import * as Secp256k1 from './src/utils/secp256k1.js'
import * as UintArray from './src/utils/uintArray.js'
import * as Persister from './src/utils/persister.js'

const Networks = NetworkInfo.networks

export const Core = { KeyPair, Networks, NetworkInfo }
export const HD = { Derive, ExtendedKey, HDKey, Paths }
export const Utils = { Base, Formatter, Hash, Require, Secp256k1, Persister, UintArray }

export * from './types/types.js'
