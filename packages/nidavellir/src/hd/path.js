// @flow

import { type HDPath } from '../../types/hd.js'
import { networks } from '../core/networkInfo.js'

export const createSinglePath = (
  account: number = 0,
  parent: HDPath = { path: ['m'] },
  hardened?: boolean
): HDPath => {
  const { chain = 'external', scriptType = 'P2PKH' } = parent

  const accountStr = `${account}${hardened ? "'" : ''}`
  const index = chain === 'external' ? '0' : '1'
  const path = [...parent.path, accountStr, index]

  return { path, chain, scriptType }
}

export const createMultiplePaths = (
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
      paths.push(...createMultiplePaths(p, coinType, account, network))
    }
    return paths
  }

  if (purpose === 32) return [createSinglePath(account)]

  const pathSettings = supportedHDPaths.find(path => path.purpose === purpose)
  if (!pathSettings) throw new Error(`Unknown derivation purpose ${purpose}`)

  const { scriptType } = pathSettings
  const path = ['m', `${purpose}'`, `${coinType || 0}'`]
  const hdPath = { path, scriptType }
  const hdPathInt = { ...hdPath, chain: 'internal' }

  return [
    createSinglePath(account, hdPath, true),
    createSinglePath(account, hdPathInt, true)
  ]
}
