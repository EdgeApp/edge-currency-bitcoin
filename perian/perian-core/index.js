// @flow

import * as Derive from './src/bip32/derive.js'
import * as ExtendedKey from './src/bip32/extendedKey.js'
import * as HDKey from './src/bip44/hdKey.js'
import * as Paths from './src/bip44/paths.js'
import * as KeyPair from './src/commons/keyPair.js'
import * as Network from './src/commons/network.js'
import * as Base from './src/utils/base.js'
import * as Crypto from './src/utils/crypto.js'

import * as bitcoin from '@perian/network-bitcoin'
import * as bitcoincash from '@perian/network-bitcoincash'
import * as bitcoincashsv from '@perian/network-bitcoincashsv'
import * as dash from '@perian/network-dash'
import * as digibyte from '@perian/network-digibyte'
import * as dogecoin from '@perian/network-dogecoin'
import * as eboost from '@perian/network-eboost'
import * as feathercoin from '@perian/network-feathercoin'
import * as bitcoingold from '@perian/network-bitcoingold'
import * as groestlcoin from '@perian/network-groestlcoin'
import * as litecoin from '@perian/network-litecoin'
import * as qtum from '@perian/network-qtum'
import * as smartcash from '@perian/network-smartcash'
import * as uniformfiscalobject from '@perian/network-uniformfiscalobject'
import * as vertcoin from '@perian/network-vertcoin'
import * as zcoin from '@perian/network-zcoin'

// $FlowFixMe
Network.addNetworks({
  bitcoin,
  bitcoincash,
  bitcoincashsv,
  dash,
  digibyte,
  dogecoin,
  eboost,
  feathercoin,
  bitcoingold,
  groestlcoin,
  litecoin,
  qtum,
  smartcash,
  uniformfiscalobject,
  vertcoin,
  zcoin
})

const Utils = { Crypto, Base }
const Commons = { KeyPair, Network }
const Bip32 = { Derive, ExtendedKey }
const Bip44 = { Paths, HDKey }

export { Utils, Commons, Bip32, Bip44 }
export * from './types/types.js'
