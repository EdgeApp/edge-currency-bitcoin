// @flow

import type {
  HDPath,
  HDSettings,
  HDStandardPathParams
} from '../../types/bip44.js'

export const bip44Path = (params: HDStandardPathParams = {}) => [
  `${params.coinType ? params.coinType : 0}'`,
  `${params.account ? params.account : 0}'`
]

export const fromBips = (
  bips?: Array<number>,
  hdSettings: HDSettings = defaultSettings
): HDSettings =>
  bips
    ? bips.reduce(
      (res, bip) =>
        Object.assign(res, { [`${bip}'`]: hdSettings[`${bip}'`] }),
      {}
    )
    : defaultSettings

export const fromSettings = (
  hdSettings: HDSettings,
  pathParams?: HDStandardPathParams,
  parentHDPath?: HDPath,
  hdPaths: Array<HDPath> = []
): Array<HDPath> => {
  const { chain, scriptType } = parentHDPath || {}
  const path = parentHDPath ? parentHDPath.path : ['m']
  for (const index in hdSettings) {
    const hdSetting = hdSettings[index]
    const childPath = [...path, index]
    const { path: pathFunc, children, ...rest } = hdSetting
    if (typeof pathFunc === 'function') {
      const extraPath = pathFunc(pathParams)
      childPath.push(...extraPath)
    }
    const hdPath = { ...rest, path: childPath }
    if (!hdPath.scriptType && scriptType) hdPath.scriptType = scriptType
    if (!hdPath.chain && chain) hdPath.chain = chain
    if (children) {
      fromSettings(children, pathParams, hdPath, hdPaths)
    } else hdPaths.push(hdPath)
  }
  return hdPaths
}

export const defaultSettings: HDSettings = {
  "32'": {
    scriptType: 'P2PKH-AIRBITZ',
    path: () => ['0'],
    children: {
      '0': { chain: 'external' }
    }
  },
  "44'": {
    scriptType: 'P2PKH',
    path: bip44Path,
    children: {
      '0': { chain: 'external' },
      '1': { chain: 'internal' }
    }
  },
  "49'": {
    scriptType: 'P2WPKH-P2SH',
    path: bip44Path,
    children: {
      '0': { chain: 'external' },
      '1': { chain: 'internal' }
    }
  },
  "84'": {
    scriptType: 'P2WPKH',
    path: bip44Path,
    children: {
      '0': { chain: 'external' },
      '1': { chain: 'internal' }
    }
  }
}
