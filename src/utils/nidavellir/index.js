// @flow

import * as PrivateKey from './src/core/privateKey.js'
import * as NetworkInfo from './src/core/networkInfo.js'
import * as XKey from './src/hd/xkey.js'
import * as XPriv from './src/hd/xpriv.js'
import * as XPub from './src/hd/xpub.js'
import * as Path from './src/hd/path.js'
import * as Base from './src/utils/base.js'
import * as Formatter from './src/utils/formatter.js'
import * as Hash from './src/utils/hash.js'
import * as Persister from './src/utils/persister.js'
import * as Require from './src/utils/require.js'
import * as Secp256k1 from './src/utils/secp256k1.js'
import * as UintArray from './src/utils/uintArray.js'

const Networks = NetworkInfo.networks

export const Core = { PrivateKey, Networks, NetworkInfo }
export const HD = { XPriv, XPub, XKey, Path }
export const Utils = {
  Base,
  Formatter,
  Hash,
  Require,
  Secp256k1,
  Persister,
  UintArray
}

export * from './types/types.js'
