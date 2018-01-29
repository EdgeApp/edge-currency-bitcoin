// @flow
import type { OnFailHandler, StratumTask } from './stratumConnection.js'
import { validateObject } from '../utils/utils.js'
import {
  electrumVersionSchema,
  electrumFetchHeaderSchema,
  electrumSubscribeHeadersSchema,
  electrumFetchHistorySchema,
  electrumSubscribeScriptHashSchema,
  electrumHeaderSchema,
  electrumFetchUtxoSchema
} from '../utils/jsonSchemas.js'

const taskTemplate = (
  method: string,
  parseReply: (reply: any) => any,
  params: Array<string>,
  onDone: (result: any) => void,
  onFail: OnFailHandler
) => {
  return {
    method,
    onFail,
    params: Array.isArray(params) ? params : [params],
    onDone: (reply: any) => onDone(parseReply(reply))
  }
}

/**
 * Creates a server version query message.
 */
export function fetchVersion (...taskOptions: Array<any>) {
  return taskTemplate(
    'server.version',
    (reply: any) => {
      if (validateObject(reply.map(parseFloat), electrumVersionSchema)) {
        return reply[1].toString()
      }
      throw new Error(`Bad Stratum version reply ${reply}`)
    },
    ['1.1', '1.1'],
    ...taskOptions
  )
}

/**
 * Creates a height subscription message.
 * @param {*} onDone Called for every height update.
 * @param {*} onFail Called if the subscription fails.
 */
export function subscribeHeight (...taskOptions: Array<any>): StratumTask {
  return taskTemplate(
    'blockchain.headers.subscribe',
    (reply: any) => {
      if (validateObject(reply, electrumSubscribeHeadersSchema)) {
        return reply.params[0].block_height
      }
      if (validateObject(reply, electrumHeaderSchema)) {
        return reply.block_height
      }
      throw new Error(`Bad Stratum height reply ${reply}`)
    },
    [],
    ...taskOptions
  )
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
export function fetchBlockHeader (...taskOptions: Array<any>): StratumTask {
  return taskTemplate(
    'blockchain.block.get_header',
    (reply: any) => {
      if (validateObject(reply, electrumFetchHeaderSchema)) {
        return reply
      }
      throw new Error(`Bad Stratum get_header reply ${reply}`)
    },
    ...taskOptions
  )
}

/**
 * Gets a transaction.
 * @param {string} txid Txid of transaction to fetch
 * @param {*} onDone Called when block header data is available.
 * @param {*} onFail Called if the request fails.
 */
export function fetchTransaction (...taskOptions: Array<any>): StratumTask {
  return taskTemplate(
    'blockchain.transaction.get',
    (reply: any) => {
      if (typeof reply === 'string') {
        return reply
      }
      throw new Error(`Bad Stratum transaction.get reply ${reply}`)
    },
    ...taskOptions
  )
}

/**
 * Subscribes to a script hash (address in script hash format).
 * @param {string} scriptHash Script hash to fetch change hash for
 * @param {*} onDone Called each time the script hash's hash changes.
 * @param {*} onFail Called if the request fails.
 */
export function subscribeScriptHash (...taskOptions: Array<any>): StratumTask {
  return taskTemplate(
    'blockchain.scripthash.subscribe',
    (reply: any) => {
      if (reply === null) {
        return null
      }
      if (typeof reply === 'string') {
        return reply
      }
      if (validateObject(reply, electrumSubscribeScriptHashSchema)) {
        return reply.params[1]
      }
      throw new Error(`Bad Stratum scripthash.subscribe reply ${reply}`)
    },
    ...taskOptions
  )
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
export function fetchScriptHashHistory (...taskOptions: Array<any>): StratumTask {
  return taskTemplate(
    'blockchain.scripthash.get_history',
    (reply: any) => {
      if (reply === null) return reply
      if (validateObject(reply, electrumFetchHistorySchema)) {
        return reply
      }
      throw new Error(`Bad Stratum scripthash.get_history reply ${reply}`)
    },
    ...taskOptions
  )
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
export function fetchScriptHashUtxo (...taskOptions: Array<any>): StratumTask {
  return taskTemplate(
    'blockchain.scripthash.listunspent',
    (reply: any) => {
      if (validateObject(reply, electrumFetchUtxoSchema)) {
        return reply
      }
      throw new Error(`Bad Stratum scripthash.listunspent reply ${reply}`)
    },
    ...taskOptions
  )
}

export function broadcastTx (...taskOptions: Array<any>): StratumTask {
  return taskTemplate(
    'blockchain.transaction.broadcast',
    (reply: any) => {
      if (typeof reply !== 'string') {
        return reply
      }
      throw new Error(`transaction.broadcast error. reply ${reply}`)
    },
    ...taskOptions
  )
}

export function fetchEstimateFee (...taskOptions: Array<any>): StratumTask {
  return taskTemplate(
    'blockchain.estimatefee',
    (reply: any) => {
      if (reply != null) {
        return parseInt(reply)
      }
      throw new Error(`blockchain.estimatefee error. reply ${reply}`)
    },
    ...taskOptions
  )
}
