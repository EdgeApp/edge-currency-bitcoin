// @flow
import type { OnFailHandler, StratumTask } from './stratum-connection.js'
import { validateObject } from '../utils/utils.js'
import { electrumVersionSchema, electrumFetchHeaderSchema } from '../utils/jsonSchemas.js'

/**
 * Creates a server version query message.
 */
export function fetchVersion (
  onDone: (version: string) => void,
  onFail: OnFailHandler
) {
  return {
    method: 'server.version',
    params: ['1.1', '1.1'],
    onDone (reply: any) {
      let ver = 0
      const valid = validateObject(reply, electrumVersionSchema)
      if (typeof reply === 'string') {
        const parsed = reply.replace(/electrumx/i, '').replace(/electrum/i, '')
        ver = parseFloat(parsed)
      } else if (valid && reply.length === 2) {
        ver = parseFloat(reply[1])
      } else {
        throw new Error(`Bad Stratum version reply ${reply}`)
      }
      if (ver < 1.1) {
        throw new Error('Stratum version too low' + ver.toString())
      }
      onDone(ver.toString())
    },
    onFail
  }
}

/**
 * Creates a height subscription message.
 * @param {*} onDone Called for every height update.
 * @param {*} onFail Called if the subscription fails.
 */
export function subscribeHeight (
  onDone: (height: number) => void,
  onFail: OnFailHandler
): StratumTask {
  return {
    method: 'blockchain.numblocks.subscribe',
    params: [],
    onDone (reply: any) {
      if (typeof reply !== 'number') {
        throw new Error(`Bad Stratum height reply ${reply}`)
      }
      onDone(reply)
    },
    onFail
  }
}

/**
 * Gets a block header.
 * @param {*} onDone Called when block header data is available.
 * @param {*} onFail Called if the request fails.
 */
export type FetchBlockHeaderType = {
  'block_height': number,
  'version': number,
  'prev_block_hash': string,
  'merkle_root': string,
  'timestamp': number,
  'bits': number,
  'nonce': number
}
export function fetchBlockHeader (
  blockNumber: number,
  onDone: (header: FetchBlockHeaderType) => void,
  onFail: OnFailHandler
): StratumTask {
  return {
    method: 'blockchain.block.get_header',
    params: [blockNumber],
    onDone (reply: any) {
      const valid = validateObject(reply, electrumFetchHeaderSchema)
      if (!valid) {
        throw new Error(`Bad Stratum get_header reply ${reply}`)
      }
      onDone(reply)
    },
    onFail
  }
}
