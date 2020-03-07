// @flow

import { Buffer } from 'buffer'

import bcoin from 'bcoin'

import { type KeyRings } from '../../../types/bcoinUtils.js'
import { Core, HD } from '../nidavellir'
import { base64regex } from '../utils.js'

const { Mnemonic } = bcoin.hd

export const parseSeed = (seed: string) =>
  base64regex.test(seed) ? Buffer.from(seed, 'base64').toString('hex') : seed

export const seedToHex = async (
  seed: string,
  network: string
): Promise<string> => {
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
  wifs: Array<string>,
  network: string
): Promise<KeyRings> => {
  const hdPaths = HD.Paths.ScriptTypes

  const promises = []
  for (const bip in hdPaths) {
    const scriptType = hdPaths[bip]
    for (const wif of wifs) {
      const keyPromise = Core.KeyPair.fromWif(wif, network).then(key => ({
        ...key,
        scriptType
      }))
      promises.push(keyPromise)
    }
  }

  const keyRings = await Promise.all(promises)
  return keyRings
}
