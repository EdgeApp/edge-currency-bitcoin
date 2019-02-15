// @flow

import type { KeyRings } from './types.js'
import bcoin from 'bcoin'

import { Buffer } from 'buffer'

import { Core } from 'nidavellir'
import { base64regex } from '../utils.js'

const { Mnemonic } = bcoin.hd

export const parseSeed = (seed: string) =>
  base64regex.test(seed) ? Buffer.from(seed, 'base64').toString('hex') : seed

export const seedToHex = async (seed: string, network: string): Promise<string> => {
  if (base64regex.test(seed)) {
    const res = Buffer.from(seed, 'base64').toString('hex')
    return res
  } else {
    const rawSeed = Mnemonic.fromPhrase(seed)
    const hex = await rawSeed.toSeed()
    return hex.toString('hex')
  }
}

export const keysFromEntropy = (
  entropy: Buffer,
  network: string,
  opts: any = {}
) => {
  const { keyPrefix = {} } = Core.Networks[network] || {}
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
  const { hdSettings } = Core.Networks[network]
  for (const settings in hdSettings) {
    const { scriptType } = hdSettings[settings]
    for (const key of privateKeys) {
      const keyPair = await Core.KeyPair.keyPairFromWIF(key, network)
      keys.push({ ...keyPair, scriptType })
    }
  }
  return keys
}
