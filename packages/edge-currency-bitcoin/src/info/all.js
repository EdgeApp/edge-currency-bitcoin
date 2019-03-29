// @flow

import { type CurrencyPluginSettings } from '../../types/plugin.js'
import { setDefaultInfo } from './baseInfo.js'
import { bitcoin } from './bitcoin.js'
import { bitcoincash } from './bitcoincash.js'
import { bitcoincashTestnet } from './bitcoincashtestnet.js'
import { bitcoingold } from './bitcoingold.js'
import { bitcoingoldTestnet } from './bitcoingoldtestnet.js'
import { bitcoinsv } from './bitcoinsv.js'
import { bitcoinTestnet } from './bitcointestnet.js'
import { dash } from './dash.js'
import { digibyte } from './digibyte.js'
import { dogecoin } from './dogecoin.js'
import { eboost } from './eboost.js'
import { feathercoin } from './feathercoin.js'
import { groestlcoin } from './groestlcoin.js'
import { litecoin } from './litecoin.js'
import { qtum } from './qtum.js'
import { smartcash } from './smartcash.js'
import { ufo } from './ufo.js'
import { vertcoin } from './vertcoin.js'
import { zcoin } from './zcoin.js'

export const allInfo: Array<CurrencyPluginSettings> = [
  bitcoin,
  bitcoincash,
  bitcoincashTestnet,
  bitcoingold,
  bitcoingoldTestnet,
  bitcoinsv,
  bitcoinTestnet,
  dash,
  digibyte,
  dogecoin,
  eboost,
  feathercoin,
  groestlcoin,
  litecoin,
  qtum,
  smartcash,
  ufo,
  vertcoin,
  zcoin
].map(setDefaultInfo)
