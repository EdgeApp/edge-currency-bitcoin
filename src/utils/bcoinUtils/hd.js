// @flow
import type {
  branchSettings,
  Branches,
  Script,
  DerivedAddress
} from './types.js'
import { addressFromKey } from './address.js'
import { setKeyTypeWrap } from './key.js'
import { branchesSettings } from './bips.js'
import { getNetworkSettings } from './misc.js'

export type FullBranchesSettings = {
  branches: { [branchName: string]: branchSettings },
  scriptTemplates: any
}

export const getBranchesSettings = (
  network: string = 'main',
  branchName?: string
): FullBranchesSettings => {
  const { supportedBips } = getNetworkSettings(network)
  const scriptTemplates = {
    addresses: [],
    branchNumber: 0,
    path: () => '',
    nested: false,
    witness: false,
    scriptType: ''
  }

  // const { scriptTemplates = {} } = networks[network] || {}
  // for (const scriptName in scriptTemplates) {
  //   const template = scriptTemplates[scriptName]()
  //   const defaultScript = typeof template === 'function' ? template() : template
  //   const branchNum = parseInt(defaultScript.slice(-8), 16)
  //   branches[`${branchNum}`] = scriptName
  // }

  const branchesNames =
    branchName && branchName !== '' ? [branchName] : supportedBips
  const branches = {}

  for (const branchName of branchesNames) {
    if (!branchesSettings[branchName]) throw new Error('Unknown bip type')
    const branch: branchSettings = branchesSettings[branchName]
    if (!branches.default) branches['default'] = branch
    Object.assign(branches, { [branchName]: branch })
  }

  return { branches, scriptTemplates }
}

export const parsePath = (
  path: string = '',
  masterPath: string
): Array<number> =>
  (path.split(`${masterPath}`)[1] || '')
    .split('/')
    .filter(i => i !== '')
    .map(i => parseInt(i))

export const deriveHdKey = (parentKey: any, index: number): Promise<any> =>
  Promise.resolve(parentKey.derive(index))

export const deriveAddress = (
  parentKey: any,
  index: number,
  nested: boolean,
  witness: boolean,
  network: string
): Promise<any> =>
  deriveHdKey(parentKey, index)
    .then(key => setKeyTypeWrap(key, nested, witness, network))
    .then(key => addressFromKey(key, network))

export const deriveKeyRing = (
  parentKey: any,
  index: number,
  nested: boolean,
  witness: boolean,
  network: string,
  redeemScript?: string
): Promise<any> =>
  deriveHdKey(parentKey, index).then(derivedKey =>
    setKeyTypeWrap(derivedKey, nested, witness, network, redeemScript)
  )

export const deriveScriptAddress = async (
  parentKey: any,
  index: number,
  branch: number,
  nested: boolean,
  witness: boolean,
  network: string,
  branches: Branches,
  scriptTemplates: any,
  scriptObj?: Script
): Promise<DerivedAddress | null> => {
  const branchName = branches[`${branch}`]
  const childKey = await deriveHdKey(parentKey, index)
  let redeemScript = null
  if (scriptObj) {
    const scriptTemplate = scriptTemplates[scriptObj.type]
    redeemScript = scriptTemplate(childKey)(scriptObj.params)
  } else if (scriptTemplates[branchName]) {
    const scriptTemplate = scriptTemplates[branchName]
    const temp = scriptTemplate(childKey)
    if (typeof temp === 'string') redeemScript = temp
  }
  if (!redeemScript) return null
  const typedKey = await setKeyTypeWrap(
    childKey,
    nested,
    witness,
    network,
    redeemScript
  )
  const address = await addressFromKey(typedKey, network)
  return { ...address, redeemScript }
}
