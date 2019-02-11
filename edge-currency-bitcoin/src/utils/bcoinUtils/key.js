// @flow

import type { KeyRings } from './types.js'
import bcoin from 'bcoin'

import { Buffer } from 'buffer'

import { Commons } from 'perian'
import { base64regex } from '../utils.js'

const { Mnemonic } = bcoin.hd
const { networks } = Commons.Network

export const parseSeed = (seed: string) =>
  base64regex.test(seed) ? Buffer.from(seed, 'base64').toString('hex') : seed

export const seedToHex = (seed: string, network: string): string => {
  if (base64regex.test(seed)) {
    const res = Buffer.from(seed, 'base64').toString('hex')
    return res
  } else {
    const res = Mnemonic.fromPhrase(seed)
      .toSeed()
      .toString('hex')
    return res
  }
}

export const keysFromEntropy = (
  entropy: Buffer,
  network: string,
  opts: any = {}
) => {
  const { keyPrefix = {} } = networks[network] || {}
  return {
    [`${network}Key`]: Mnemonic.fromEntropy(entropy).getPhrase(),
    coinType: opts.coinType || keyPrefix.coinType || 0
  }
}

export const getAllKeyRings = async (
  privateKeys: Array<string>,
  network: string
): Promise<KeyRings> => {
  const keys = []
  const { hdSettings } = networks[network]
  for (const settings in hdSettings) {
    const { scriptType } = hdSettings[settings]
    for (const key of privateKeys) {
      const keyPair = await Commons.KeyPair.keyPairFromWIF(key, network)
      keys.push({ ...keyPair, scriptType })
    }
  }
  return keys
}
