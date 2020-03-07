// @flow

import { type PluginIo } from './plugin.js'

export type StratumBlockHeader = {
  block_height: number,
  version: number,
  prev_block_hash: string,
  merkle_root: string,
  timestamp: number,
  bits: number,
  nonce: number
}

export type StratumHistoryRow = {
  tx_hash: string,
  height: number,
  fee?: number
}

export type StratumUtxo = {
  tx_hash: string,
  tx_pos: number,
  value: number,
  height: number
}

export type OnFailHandler = (error: Error) => void

/**
 * This is a private type used by the Stratum connection.
 * Use the static task-creator methods to build these.
 */
export interface StratumTask {
  method: string;
  params: Array<any>;
  +onDone: (reply: any, requestMs: number) => void;
  +onFail: OnFailHandler;
}

export interface StratumCallbacks {
  +onOpen: () => void;
  +onClose: (error?: Error) => void;
  +onQueueSpace: () => StratumTask | void;
  +onNotifyHeader: (headerInfo: StratumBlockHeader) => void;
  +onNotifyScriptHash: (scriptHash: string, hash: string) => void;
  +onTimer: (queryTime: number) => void;
  +onVersion: (version: string, requestMs: number) => void;
}

export interface StratumOptions {
  callbacks: StratumCallbacks;
  io: PluginIo;
  queueSize?: number; // defaults to 10
  timeout?: number; // seconds, defaults to 30
  walletId?: string; // for logging purposes
}

export type PendingMessage = {
  startTime: number,
  task: StratumTask
}
