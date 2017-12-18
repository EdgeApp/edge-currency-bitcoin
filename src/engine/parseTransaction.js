// @flow
import crypto from 'crypto'

import bcoin from 'bcoin'

// The information we care about from a transaction.
export type ParsedTx = {
  inputs: Array<{
    txid: string,
    index: number
  }>,

  outputs: Array<{
    scriptHash: string,
    value: number
  }>
}

/**
 * Bitcoin hashes are always backwards, so reverse the bytes in a hex hash.
 */
function reverseHash (hash: string): string {
  const groups = hash.match(/../g) || []
  return groups.reverse().join('')
}

/**
 * Parses a transaction to extract the information we care about.
 */
export function parseTransaction (rawTx: string): ParsedTx {
  const bcoinTransaction = bcoin.primitives.TX.fromRaw(rawTx, 'hex')

  const inputs: $PropertyType<ParsedTx, 'inputs'> = []
  for (const input of bcoinTransaction.inputs) {
    inputs.push({
      txid: reverseHash(input.prevout.hash),
      index: input.prevout.index
    })
  }

  const outputs: $PropertyType<ParsedTx, 'outputs'> = []
  for (const output of bcoinTransaction.outputs) {
    const scriptHash: string = crypto
      .createHash('sha256')
      .update(output.script.toRaw())
      .digest('hex')

    outputs.push({
      scriptHash: reverseHash(scriptHash),
      value: output.value
    })
  }

  return { inputs, outputs }
}
