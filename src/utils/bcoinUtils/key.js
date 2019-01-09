// @flow
// $FlowFixMe
import buffer from 'buffer-hack'
import {
  utils,
  hd,
  primitives,
  script,
  networks,
  network as Network
} from 'bcoin'
import { base64regex } from '../utils.js'
import { scriptTypeToBcoin, getNetworkSettings } from './misc.js'

const { Buffer } = buffer

export const parseSeed = (seed: string) =>
  base64regex.test(seed) ? Buffer.from(seed, 'base64').toString('hex') : seed

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

export const fromHDKey = async (
  key: any,
  network: string,
  scriptType?: string,
  redeemScript?: string
): Promise<Object> => {
  let keyRing = {}
  const { nested = false, witness = false } = scriptTypeToBcoin(scriptType)
  if (redeemScript) {
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

export const getPrivateFromSeed = async (seed: string, network: string) => {
  if (base64regex.test(seed)) {
    return hd.PrivateKey.fromSeed(Buffer.from(seed, 'base64'), network)
  } else {
    const mnemonic = hd.Mnemonic.fromPhrase(seed)
    return hd.PrivateKey.fromMnemonic(mnemonic, network)
  }
}

export const getXPubFromSeed = async ({ seed, network = 'main' }: any) => {
  const masterKey = await getPrivateFromSeed(seed, network)
  const xpubKey = await masterKey.xpubkey()
  return xpubKey
}

export const getAllKeyRings = (
  privateKeys: Array<string>,
  network: string
): Promise<any[]> => {
  const keysPromises = []
  const { hdSettings, serializers } = getNetworkSettings(network)
  for (const settings in hdSettings) {
    const { scriptType = 'P2PKH' } = hdSettings[settings]
    for (const key of privateKeys) {
      const standardKey = serializers.wif ? serializers.wif.decode(key) : key
      const keyRing = primitives.KeyRing.fromSecret(standardKey, network)
      keysPromises.push(
        Promise.resolve(keyRing)
          .then(key => fromHDKey(key, network, scriptType))
          .then(keyRing => keyRing)
      )
    }
  }
  return Promise.all(keysPromises)
}
