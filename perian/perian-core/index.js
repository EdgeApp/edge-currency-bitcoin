// @flow

import * as Derive from './src/bip32/derive.js'
import * as ExtendedKey from './src/bip32/extendedKey.js'
import * as HDKey from './src/bip44/hdKey.js'
import * as Paths from './src/bip44/paths.js'
import * as KeyPair from './src/commons/keyPair.js'
import * as Network from './src/commons/network.js'
import * as Base from './src/utils/base.js'
import * as Crypto from './src/utils/crypto.js'
import * as Plugin from './src/utils/plugin.js'

const Utils = { Crypto, Base, Plugin }
const Commons = { KeyPair, Network }
const Bip32 = { Derive, ExtendedKey }
const Bip44 = { Paths, HDKey }

Plugin.addPlugin([
  '@perian/network-bitcoin',
  '@perian/network-bitcoincash',
  '@perian/network-bitcoincashsv',
  '@perian/network-dash',
  '@perian/network-digibyte',
  '@perian/network-dogecoin',
  '@perian/network-eboost',
  '@perian/network-feathercoin',
  '@perian/network-bitcoingold',
  '@perian/network-groestlcoin',
  '@perian/network-litecoin',
  '@perian/network-qtum',
  '@perian/network-smartcash',
  '@perian/network-uniformfiscalobject',
  '@perian/network-vertcoin',
  '@perian/network-zcoin'
])

export { Utils, Commons, Bip32, Bip44 }
export * from './types/types.js'
