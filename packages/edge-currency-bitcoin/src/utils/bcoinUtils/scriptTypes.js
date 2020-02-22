// @flow

import bcoin from 'bcoin'
import { Buffer } from 'buffer'
import { type HexPair, type ScriptType, Utils } from 'nidavellir'

import { type ScriptTypeSettings } from '../../../types/bcoinUtils.js'

const { hash160, sha256 } = Utils.Hash
const { fromString, fromProgram } = bcoin.script
const dataFromPubKey = (keyPair?: HexPair, scriptHex?: string): string => {
  if (!keyPair || !keyPair.publicKey) {
    throw new Error('Cannot get address without Public Key')
  }
  if (keyPair.publicKey.length !== 66) {
    throw new Error('Wrong Public Key length')
  }
  return keyPair.publicKey
}

const dataFromScript = (keyPair?: HexPair, scriptHex?: string): string => {
  if (!scriptHex) throw new Error('Cannot get address without Locking Script')
  return fromString(scriptHex)
    .toRaw()
    .toString('hex')
}

export const defaultScriptTypes: {
  [scriptType: ScriptType]: ScriptTypeSettings
} = {
  P2PKH: {
    type: 'pubkeyhash',
    version: -1,
    getData: dataFromPubKey,
    getHash: hash160
  },
  P2SH: {
    type: 'scripthash',
    version: -1,
    getData: dataFromScript,
    getHash: hash160
  },
  'P2WPKH-P2SH': {
    type: 'scripthash',
    version: -1,
    getData: dataFromPubKey,
    getHash: (s: string) => {
      const hash = Buffer.from(hash160(s), 'hex')
      const scriptHex = fromProgram(0, hash)
        .toRaw()
        .toString('hex')
      return hash160(scriptHex)
    }
  },
  P2WPKH: {
    type: 'witnesspubkeyhash',
    version: 0,
    getData: dataFromPubKey,
    getHash: hash160
  },
  P2WSH: {
    type: 'witnessscripthash',
    version: 0,
    getData: dataFromScript,
    getHash: sha256
  }
}
