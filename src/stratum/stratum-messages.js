// @flow
import type { OnFailHandler, StratumTask } from './stratum-connection.js'
import { validateObject } from '../utils/utils.js'
import {
  arrayOfStringScheme,
  electrumFetchHeaderSchema,
  electrumSubscribeHeadersSchema,
  electrumFetchHistorySchema,
  electrumSubscribeScriptHashSchema,
  electrumHeaderSchema,
  electrumFetchUtxoSchema
} from '../utils/jsonSchemas.js'

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
      const valid = validateObject(reply, arrayOfStringScheme)
      if (valid && reply.length === 2) {
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
  const method = 'blockchain.headers.subscribe'
  return {
    method,
    params: [],
    onDone (reply: any) {
      let height = 0
      const validSubscribeHeader = validateObject(
        reply,
        electrumSubscribeHeadersSchema
      )
      if (validSubscribeHeader && reply.params.length === 1) {
        height = reply.params[0].block_height
      } else if (validateObject(reply, electrumHeaderSchema)) {
        height = reply.block_height
      } else {
        throw new Error(`Bad Stratum height reply ${reply}`)
      }
      onDone(height)
    },
    onFail
  }
}

export type StratumBlockHeader = {
  block_height: number,
  version: number,
  prev_block_hash: string,
  merkle_root: string,
  timestamp: number,
  bits: number,
  nonce: number
}

/**
 * Gets a block header.
 * @param {number} blockNumber Block number to fetch header for
 * @param {*} onDone Called when block header data is available.
 * @param {*} onFail Called if the request fails.
 */
export function fetchBlockHeader (
  blockNumber: number,
  onDone: (header: StratumBlockHeader) => void,
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

/**
 * Gets a transaction.
 * @param {string} txid Txid of transaction to fetch
 * @param {*} onDone Called when block header data is available.
 * @param {*} onFail Called if the request fails.
 */
export function fetchTransaction (
  txid: string,
  onDone: (txData: string) => void,
  onFail: OnFailHandler
): StratumTask {
  return {
    method: 'blockchain.transaction.get',
    params: [txid],
    onDone (reply: any) {
      if (typeof reply !== 'string') {
        throw new Error(`Bad Stratum transaction.get reply ${reply}`)
      }
      onDone(reply)
    },
    onFail
  }
}

/**
 * Subscribes to a script hash (address in script hash format).
 * @param {string} scriptHash Script hash to fetch change hash for
 * @param {*} onDone Called each time the script hash's hash changes.
 * @param {*} onFail Called if the request fails.
 */
export function subscribeScriptHash (
  scriptHash: string,
  onDone: (hash: string | null) => void,
  onFail: OnFailHandler
): StratumTask {
  const method = 'blockchain.scripthash.subscribe'
  return {
    method,
    params: [scriptHash],
    onDone (reply: any) {
      let hash: string | null = null
      if (reply === null) {
        hash = null
      } else if (typeof reply === 'string') {
        hash = reply
      } else if (
        validateObject(reply, electrumSubscribeScriptHashSchema) &&
        reply.method === method
      ) {
        hash = reply.params[1]
      } else {
        throw new Error(`Bad Stratum scripthash.subscribe reply ${reply}`)
      }
      onDone(hash)
    },
    onFail
  }
}

export type StratumHistoryRow = {
  tx_hash: string,
  height: number,
  fee?: number
}

/**
 * Get tx history of a script hash (address in script hash format).
 * @param {string} scriptHash Script hash to fetch tx history for
 * @param {*} onDone Called when block header data is available.
 * @param {*} onFail Called if the request fails.
 */
export function fetchScriptHashHistory (
  scriptHash: string,
  onDone: (arrayTx: Array<StratumHistoryRow>) => void,
  onFail: OnFailHandler
): StratumTask {
  const method = 'blockchain.scripthash.get_history'
  return {
    method,
    params: [scriptHash],
    onDone (reply: any) {
      if (reply !== null) {
        if (!validateObject(reply, electrumFetchHistorySchema)) {
          throw new Error(`Bad Stratum scripthash.get_history reply ${reply}`)
        }
      }
      onDone(reply)
    },
    onFail
  }
}

export type StratumUtxo = {
  tx_hash: string,
  tx_pos: number,
  value: number,
  height: number
}

/**
 * Get utxo list of a script hash (address in script hash format).
 * @param {string} scriptHash Script hash to fetch uxtos for
 * @param {*} onDone Called when block header data is available.
 * @param {*} onFail Called if the request fails.
 */
export function fetchScriptHashUtxo (
  scriptHash: string,
  onDone: (arrayTx: Array<StratumUtxo>) => void,
  onFail: OnFailHandler
): StratumTask {
  const method = 'blockchain.scripthash.listunspent'
  return {
    method,
    params: [scriptHash],
    onDone (reply: any) {
      const valid = validateObject(reply, electrumFetchUtxoSchema)
      if (!valid) {
        throw new Error(`Bad Stratum scripthash.listunspent reply ${reply}`)
      }
      onDone(reply)
    },
    onFail
  }
}

export function broadcastTx (
  rawTx: string,
  onDone: (txid: string) => void,
  onFail: OnFailHandler
): StratumTask {
  const method = 'blockchain.transaction.broadcast'
  return {
    method,
    params: [rawTx],
    onDone (reply: any) {
      if (typeof reply !== 'string') {
        throw new Error(`transaction.broadcast error. reply ${reply}`)
      }
      onDone(reply)
    },
    onFail
  }
}

export function fetchEstimateFee (
  blocksToBeIncludedIn: string,
  onDone: (fee: number) => void,
  onFail: OnFailHandler
): StratumTask {
  const method = 'blockchain.estimatefee'
  return {
    method,
    params: [blocksToBeIncludedIn],
    onDone (reply: any) {
      if (reply === null || reply === undefined) {
        throw new Error(`blockchain.estimatefee error. reply ${reply}`)
      }
      onDone(parseInt(reply))
    },
    onFail
  }
}
