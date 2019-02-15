// @flow

import * as Derive from './src/bip32/derive.js'
import * as ExtendedKey from './src/bip32/extendedKey.js'
import * as HDKey from './src/bip44/hdKey.js'
import * as Paths from './src/bip44/paths.js'
import * as KeyPair from './src/core/keyPair.js'
import * as NetworkInfo from './src/core/networkInfo.js'
import * as Base from './src/utils/base.js'
import * as Formatter from './src/utils/formatter.js'
import * as Hash from './src/utils/hash.js'
import * as Require from './src/utils/require.js'
import * as Secp256k1 from './src/utils/secp256k1.js'
import * as UintArray from './src/utils/uintArray.js'

const Bip32 = { Derive, ExtendedKey }
const Bip44 = { HDKey, Paths }
const Core = { KeyPair, Networks: NetworkInfo.networks, NetworkInfo }
const Utils = { Base, Formatter, Hash, Require, Secp256k1, UintArray }

export { Bip32, Bip44, Core, Utils }
export * from './types/types.js'
