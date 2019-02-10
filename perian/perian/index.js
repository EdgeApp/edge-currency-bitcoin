// @flow

import { Bip32, Bip44, Commons } from '@perian/core'
import * as Utils from '@perian/core-utils'
import * as bitcoin from '@perian/network-bitcoin'
import * as bitcoincash from '@perian/network-bitcoincash'
import * as bitcoingold from '@perian/network-bitcoingold'
import * as bitcoinsv from '@perian/network-bitcoinsv'
import * as dash from '@perian/network-dash'
import * as digibyte from '@perian/network-digibyte'
import * as dogecoin from '@perian/network-dogecoin'
import * as eboost from '@perian/network-eboost'
import * as feathercoin from '@perian/network-feathercoin'
import * as groestlcoin from '@perian/network-groestlcoin'
import * as litecoin from '@perian/network-litecoin'
import * as qtum from '@perian/network-qtum'
import * as smartcash from '@perian/network-smartcash'
import * as uniformfiscalobject from '@perian/network-uniformfiscalobject'
import * as vertcoin from '@perian/network-vertcoin'
import * as zcoin from '@perian/network-zcoin'

// $FlowFixMe
Commons.Network.addNetworks({
  bitcoin,
  bitcoincash,
  bitcoinsv,
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

export { Utils, Commons, Bip32, Bip44 }
export * from '@perian/core'
export * from '@perian/core-utils'
