// @flow
import bcoin from 'bcoin'
import { hash256, reverseBufferToHex } from '../utils/utils.js'

/**
 * Parses a transaction to extract the information we care about.
 */
export async function parseTransaction (rawTx: string) {
  const bcoinTransaction = bcoin.primitives.TX.fromRaw(rawTx, 'hex')

  for (const output of bcoinTransaction.outputs) {
    const scriptHash = await hash256(output.script.toRaw())
    output.scriptHash = reverseBufferToHex(scriptHash)
  }

  return bcoinTransaction
}
