// @flow
// $FlowFixMe
import buffer from 'buffer-hack'
import type { Script } from '../utils/coinUtils.js'
import type { Keys } from '../engine/keyManager'
import { hd, primitives, consensus, networks } from 'bcoin'
import {
  getPrivateFromSeed,
  addressFromKey,
  setKeyType
} from '../utils/coinUtils.js'

const { Buffer } = buffer
const witScale = consensus.WITNESS_SCALE_FACTOR

export type DerivedAddress = {
  address: string,
  scriptHash: string,
  redeemScript?: string
}
export type BranchName = string

export type Branches = {
  [branchNum: string]: BranchName
}

export type DerivationConfig = {
  nested: boolean,
  witness: boolean,
  branches: Branches,
  network: string,
  bip: string,
  scriptTemplates: any
}

export const SUPPORTED_BIPS = ['bip32', 'bip44', 'bip49', 'bip84']

export const getAllKeyRings = (
  privateKeys: Array<string>,
  network: string
): Promise<any[]> => {
  const keysPromises = []
  const { formats } = networks[network]
  for (const bip of formats) {
    const config = getDerivationConfiguration(bip, network)
    for (const key of privateKeys) {
      const keyRing = primitives.KeyRing.fromSecret(key, network)
      keysPromises.push(
        Promise.resolve(keyRing).then(async (key) => setKeyTypeWrap(config, key))
      )
    }
  }
  return Promise.all(keysPromises)
}

export const getAllAddresses = (
  privateKeys: Array<string>,
  network: string
): Promise<any[]> =>
  getAllKeyRings(privateKeys, network).then(keyRings =>
    Promise.all(keyRings.map(key => addressFromKey(key, network)))
  )

export const getXPubFromSeed = async ({
  seed,
  format = 'bip32',
  network = 'main',
  account = 0,
  coinType = 0
}: any) => {
  const config = getDerivationConfiguration(format, network)
  const masterKey = await getPrivateFromSeed(seed, network)
  const masterPath = createMasterPath(config, account, coinType)
  const privateKey = await masterKey.derivePath(masterPath)
  const xpubKey = await privateKey.xpubkey()
  return xpubKey
}

export const getDerivationConfiguration = (
  format: string = 'bip32',
  network: string = 'main'
): DerivationConfig => {
  if (!SUPPORTED_BIPS.includes(format)) throw new Error('Unknown bip type')
  const bip = parseInt(format.split('bip')[1])

  const branches: Branches = { '0': 'receive' }
  if (bip !== 32) Object.assign(branches, { '1': 'change' })
  const nested = bip === 49
  const witness = bip === 49 || bip === 84
  const { scriptTemplates = {} } = networks[network] || {}
  for (const scriptName in scriptTemplates) {
    const template = scriptTemplates[scriptName]()
    const defaultScript = typeof template === 'function' ? template() : template
    const branchNum = parseInt(defaultScript.slice(-8), 16)
    branches[`${branchNum}`] = scriptName
  }
  return {
    nested,
    witness,
    branches,
    network,
    bip: bip.toString(),
    scriptTemplates
  }
}

export const setKeyTypeWrap = (
  { nested, witness, network }: DerivationConfig,
  key: any,
  redeemScript?: string
) => setKeyType(key, nested, witness, network, redeemScript)

export const deriveHdKey = (parentKey: any, index: number): Promise<any> =>
  Promise.resolve(parentKey.derive(index))

export const sign = (
  { network }: DerivationConfig,
  tx: any,
  keys: Array<any>
): Promise<{ txid: string, signedTx: string }> =>
  Promise.resolve(tx.template(keys))
    .then(() => {
      tx.network = network
      return tx.sign(keys, networks[network].replayProtection)
    })
    .then(() => {
      const { serializers = {} } = networks[network] || {}
      if (serializers.txHash) {
        tx._hash = serializers.txHash(tx.toNormal().toString('hex'))
      }
      const txid = tx.rhash()
      return { txid, signedTx: tx.toRaw().toString('hex') }
    })

export const getMasterKeys = async (
  { network }: DerivationConfig,
  seed: string,
  masterPath: string,
  privKey?: any
) => {
  if (!privKey) {
    const privateKey = await getPrivateFromSeed(seed, network)
    privKey = await privateKey.derivePath(masterPath)
  }
  const pubKey = await privKey.toPublic()
  return { privKey, pubKey }
}

export const hasScript = (
  { scriptTemplates, branches }: DerivationConfig,
  branch: number,
  scriptObj?: Script
): boolean => {
  if (scriptObj) {
    if (!scriptTemplates[scriptObj.type]) {
      throw new Error('Unkown script template')
    }
    return true
  }
  if (scriptTemplates[branches[`${branch}`]]) return true
  return false
}

export const parseSeed = ({ bip }: DerivationConfig) =>
  bip === 32
    ? (seed: string) => Buffer.from(seed, 'base64').toString('hex')
    : (seed: string) => seed

export const createMasterPath = (
  { bip, network }: DerivationConfig,
  account: number,
  coinType: number
) =>
  bip === 32
    ? 'm/0'
    : `m/${bip}'/${
      coinType >= 0 ? coinType : networks[network].keyPrefix.coinType
    }'/${account}'`

export const deriveAddress = (
  config: DerivationConfig,
  parentKey: any,
  index: number
): Promise<any> =>
  deriveHdKey(parentKey, index)
    .then(key => setKeyTypeWrap(config, key))
    .then(key => addressFromKey(key, config.network))

export const deriveKeyRing = (
  config: DerivationConfig,
  parentKey: any,
  index: number,
  redeemScript?: string
): Promise<any> =>
  deriveHdKey(parentKey, index).then(derivedKey =>
    setKeyTypeWrap(config, derivedKey, redeemScript)
  )

export const deriveScriptAddress = async (
  config: DerivationConfig,
  parentKey: any,
  index: number,
  branch: number,
  scriptObj?: Script
): Promise<DerivedAddress | null> => {
  const { network, branches, scriptTemplates } = config
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
  const typedKey = await setKeyTypeWrap(config, childKey, redeemScript)
  const address = await addressFromKey(typedKey, network)
  return { ...address, redeemScript }
}

export const keysFromRaw = (
  { network, branches }: DerivationConfig,
  rawKeys: any = {}
): Keys => {
  // init needed for flow
  const keyRings = {
    master: { pubKey: null, privKey: null, children: [] },
    receive: { pubKey: null, privKey: null, children: [] },
    change: { pubKey: null, privKey: null, children: [] }
  }
  const branchesNames: Array<string> = [
    'master',
    ...(Object.values(branches): any)
  ]
  for (const branchName of branchesNames) {
    const { xpub, xpriv } = rawKeys[branchName] || {}
    keyRings[branchName] = {
      pubKey: xpub ? hd.PublicKey.fromBase58(xpub, network) : null,
      privKey: xpriv ? hd.PrivateKey.fromBase58(xpriv, network) : null,
      children: []
    }
  }
  return keyRings
}

export const estimateSize = ({ bip }: DerivationConfig, prev: any) => {
  const address = prev.getAddress()
  if (!address) return -1

  let size = 0

  if (prev.isScripthash()) {
    if (bip === 49) {
      size += 23 // redeem script
      size *= 4 // vsize
      // Varint witness items length.
      size += 1
      // Calculate vsize
      size = ((size + witScale - 1) / witScale) | 0
    }
  }

  // P2PKH
  if (bip !== 49) {
    // varint script size
    size += 1
    // OP_PUSHDATA0 [signature]
    size += 1 + 73
    // OP_PUSHDATA0 [key]
    size += 1 + 33
  }

  return size || -1
}
