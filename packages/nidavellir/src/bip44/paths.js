// @flow

import type { HDPath, ScriptType } from '../../types/bip32.js'
import { createPath } from '../bip32/hdKey.js'
import { networks } from '../core/networkInfo.js'

export const createPaths = (
  purpose?: number | Array<number>,
  coinType: number = 0,
  account: number = 0,
  network: string = 'main'
): Array<HDPath> => {
  if (!purpose) purpose = networks[network].bips

  if (Array.isArray(purpose)) {
    const paths = []
    for (const p of purpose) {
      paths.push(...createPaths(p, coinType, account))
    }
    return paths
  }

  if (purpose === 32) return [ createPath(account) ]

  const scriptType = ScriptTypes[`${purpose}`]
  if (!scriptType) throw new Error(`Unknown derivation purpose ${purpose}`)

  const path = [ 'm', `${purpose}'`, `${coinType || 0}'` ]
  const hdPath = { path, scriptType }
  const hdPathInt = { ...hdPath, chain: 'internal' }

  return [
    createPath(account, hdPath, true),
    createPath(account, hdPathInt, true)
  ]
}

export const ScriptTypes: { [purpose: string]: ScriptType } = {
  '44': 'P2PKH',
  '49': 'P2WPKH-P2SH',
  '84': 'P2WPKH'
}
