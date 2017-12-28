// @flow
import bcoin from 'bcoin'
import { hash256Sync, reverseBufferToHex } from '../utils/utils.js'

/**
 * Parses a transaction to extract the information we care about.
 */
export function parseTransaction (rawTx: string) {
  const bcoinTransaction = bcoin.primitives.TX.fromRaw(rawTx, 'hex')

  for (const output of bcoinTransaction.outputs) {
    const scriptHash = hash256Sync(output.script.toRaw())
    output.scriptHash = reverseBufferToHex(scriptHash)
  }

  return bcoinTransaction
}
