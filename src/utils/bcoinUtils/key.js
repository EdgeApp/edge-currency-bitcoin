// @flow
// $FlowFixMe
import buffer from 'buffer-hack'
import type { Branches } from './types.js'
import type { Keys } from '../../engine/keyManager'
import {
  utils,
  hd,
  primitives,
  script,
  networks,
  network as Network
} from 'bcoin'
import { getBranchesSettings } from './hd.js'
import { getNetworkSettings } from './misc.js'

const { Buffer } = buffer

export const parseSeed = (bip: number, seed: string) =>
  bip === 32 ? Buffer.from(seed, 'base64').toString('hex') : seed

export const isCompressed = (key: any): boolean =>
  Buffer.isBuffer(key) &&
  key.length === 33 &&
  (key[0] === 0x02 || key[0] === 0x03)

export const keysFromEntropy = (
  entropy: Buffer,
  network: string,
  opts: any = {}
) => {
  const { keyPrefix = {} } = networks[network] || {}
  return {
    [`${network}Key`]: hd.Mnemonic.fromEntropy(entropy).getPhrase(),
    coinType: opts.coinType || keyPrefix.coinType || 0
  }
}

export const verifyWIF = (data: any, network: string) => {
  const base58 = utils.base58
  const { serializers } = getNetworkSettings(network)
  if (serializers.wif) data = serializers.wif.decode(data)
  const br = new utils.BufferReader(base58.decode(data), true)
  const version = br.readU8()
  network = Network.fromWIF(version, network)
  br.readBytes(32)
  if (br.left() > 4 && br.readU8() !== 1) {
    throw new Error('Bad compression flag.')
  }
  br.verifyChecksum()
  return true
}

export const setKeyType = async (
  key: any,
  nested: boolean,
  witness: boolean,
  network: string,
  redeemScript?: string
): Promise<Object> => {
  let keyRing = {}
  if (redeemScript) {
    nested = false
    witness = false
    keyRing = await primitives.KeyRing.fromScript(
      key.privateKey || key.publicKey,
      script.fromString(redeemScript),
      isCompressed(key.publicKey),
      network
    )
  } else {
    keyRing = await primitives.KeyRing.fromKey(
      key.privateKey || key.publicKey,
      isCompressed(key.publicKey),
      network
    )
  }

  Object.assign(keyRing, { nested, witness, network: Network.get(network) })
  return keyRing
}

export const setKeyTypeWrap = (
  key: any,
  nested: boolean,
  witness: boolean,
  network: string,
  redeemScript?: string
): Promise<Object> => setKeyType(key, nested, witness, network, redeemScript)

export const getPrivateFromSeed = async (seed: string, network: string) => {
  try {
    const mnemonic = hd.Mnemonic.fromPhrase(seed)
    return hd.PrivateKey.fromMnemonic(mnemonic, network)
  } catch (e) {
    console.log('Not a mnemonic, treating the seed as base64')
    return hd.PrivateKey.fromSeed(Buffer.from(seed, 'base64'), network)
  }
}

export const getXPubFromSeed = async ({
  seed,
  forceBranch,
  network = 'main',
  account = 0,
  coinType = 0
}: any) => {
  const { branches } = getBranchesSettings(network, forceBranch)
  const masterKey = await getPrivateFromSeed(seed, network)
  const masterPath = branches['default'].path(account, coinType, network)
  const privateKey = await masterKey.derivePath(masterPath)
  const xpubKey = await privateKey.xpubkey()
  return xpubKey
}

export const getMasterKeys = async (
  seed: string,
  masterPath: string,
  network: string,
  privKey?: any
) => {
  if (!privKey) {
    const privateKey = await getPrivateFromSeed(seed, network)
    privKey = await privateKey.derivePath(masterPath)
  }
  const pubKey = await privKey.toPublic()
  return { privKey, pubKey }
}

export const keysFromRaw = (
  branches: Branches,
  network: string,
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

export const getAllKeyRings = (
  privateKeys: Array<string>,
  network: string
): Promise<any[]> => {
  const keysPromises = []
  const { serializers } = getNetworkSettings(network)
  const { branches } = getBranchesSettings(network)
  for (const branchName of Object.keys(branches)) {
    if (branchName === 'default') continue
    const { nested, witness } = branches[branchName]
    for (const key of privateKeys) {
      const standardKey = serializers.wif ? serializers.wif.decode(key) : key
      const keyRing = primitives.KeyRing.fromSecret(standardKey, network)
      keysPromises.push(
        Promise.resolve(keyRing)
          .then(key => setKeyTypeWrap(key, nested, witness, network))
          .then(typedKey => typedKey)
      )
    }
  }
  return Promise.all(keysPromises)
}
