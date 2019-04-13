// @flow

import { type HDPath } from '../../types/hd.js'
import { createPath } from './hdKey.js'
import { networks } from '../core/networkInfo.js'

export const createPaths = (
  purpose?: number | Array<number>,
  coinType: number = 0,
  account: number = 0,
  network: string = 'main'
): Array<HDPath> => {
  const { supportedHDPaths } = networks[network]
  if (!purpose) purpose = supportedHDPaths[0].purpose

  if (Array.isArray(purpose)) {
    const paths = []
    for (const p of purpose) {
      paths.push(...createPaths(p, coinType, account))
    }
    return paths
  }

  if (purpose === 32) return [createPath(account)]

  const pathSettings = supportedHDPaths.find(path => path.purpose === purpose)
  if (!pathSettings) throw new Error(`Unknown derivation purpose ${purpose}`)

  const { scriptType } = pathSettings
  const path = ['m', `${purpose}'`, `${coinType || 0}'`]
  const hdPath = { path, scriptType }
  const hdPathInt = { ...hdPath, chain: 'internal' }

  return [
    createPath(account, hdPath, true),
    createPath(account, hdPathInt, true)
  ]
}
