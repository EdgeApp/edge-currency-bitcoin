// @flow
import type { OnFailHandler, StratumTask } from './stratum-connection.js'
import { validateObject } from '../utils/utils.js'
import {
  arrayOfStringScheme,
  electrumFetchHeaderSchema,
  electrumSubscribeHeightSchema,
  electrumFetchHistorySchema,
  electrumSubscribeScriptHashSchema,
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
  const method = 'blockchain.numblocks.subscribe'
  return {
    method,
    params: [],
    onDone (reply: any) {
      let height = 0
      if (typeof reply === 'number') {
        height = reply
      } else if (
        validateObject(reply, electrumSubscribeHeightSchema) &&
        reply.method === method
      ) {
        height = reply.params
      } else {
        throw new Error(`Bad Stratum height reply ${reply}`)
      }
      onDone(height)
    },
    onFail
  }
}

export type FetchBlockHeaderType = {
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
  onDone: (hash: string) => void,
  onFail: OnFailHandler
): StratumTask {
  const method = 'blockchain.scripthash.subscribe'
  return {
    method,
    params: [scriptHash],
    onDone (reply: any) {
      let hash: string = ''
      if (typeof reply === 'string') {
        hash = reply
      } else if (reply === null) {
        hash = ''
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
    onFail (error) {
      console.log('subscribeScriptHash onFail: ', error)
      onFail(error)
    }
  }
}

export type TxHistoryType = {
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
  onDone: (arrayTx: Array<TxHistoryType>) => void,
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
    onFail (error) {
      console.log('fetchScriptHashHistory onFail: ', error)
      onFail(error)
    }
  }
}

export type UtxoType = {
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
  onDone: (arrayTx: Array<UtxoType>) => void,
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
    onFail (error) {
      console.log('fetchScriptHashUtxo onFail: ', error)
      onFail(error)
    }
  }
}
