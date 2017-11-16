// @flow
import type { StratumCallbacks } from '../stratum/stratum-connection.js'
import { StratumConnection } from '../stratum/stratum-connection.js'

export interface EngineStateCallbacks {}

export interface EngineStateOptions {
  callbacks: EngineStateCallbacks;
  bcoin: any;
  io: any;
  localFolder: any;
}

export type UtxoObj = {
  txid: string, // tx_hash from Stratum
  index: number, // tx_pos from Stratum
  value: number // Satoshis fit in a number
}

export type AddressObj = {
  txids: Array<string>,
  txidStratumHash: string,

  utxos: Array<UtxoObj>,
  utxoStratumHash: string,

  used: boolean, // Set by `addGapLimitAddress`
  displayAddress: string, // base58 or other wallet-ready format
  path: string // TODO: Define the contents of this member.
}

export type AddressCache = {
  [scriptHash: string]: AddressObj
}

/**
 * This object holds the current state of the wallet engine.
 * It is responsible for staying connected to Stratum servers and keeping
 * this information up to date.
 */
export class EngineState {
  // On-disk address information:
  addressCache: AddressCache

  // On-disk transaction information:
  txCache: {
    [txid: string]: string // base64 data
  }

  // True if `startEngine` has been called:
  engineStarted: boolean

  // Active Stratum connection objects:
  connections: {
    [uri: string]: StratumConnection
  }

  // Status of active Stratum connections:
  serverStates: {
    [uri: string]: {
      // The server block height:
      // undefined - never subscribed
      // 0 - subscribed but no results yet
      // number - subscription result
      height: number | void,

      // Address subscriptions:
      addresses: {
        [scriptHash: string]: {
          // We have an `undefined` hash once we request a subscription,
          // but the initial hash hasn't come back yet.
          // Stratum sometimes returns `null` hashes as well:
          hash: string | null | void,
          fetchingUtxos: boolean,
          fetchingTxids: boolean,
          // Timestamp of the last hash change.
          // The server with the latest timestamp "owns" an address for the sake
          // of fetching utxos and txids:
          lastUpdate: number
        }
      },

      // All txids this server knows about (from subscribes or whatever):
      // Servers that know about txids are eligible to fetch those txs.
      // If no server knows about a txid, anybody can try fetching it,
      // but there is no penalty for failing:
      txids: Set<string>
    }
  }

  // True if somebody is currently fetching a transaction:
  txStates: {
    [txid: string]: { fetching: boolean }
  }

  // Transactions that are relevant to our addresses, but missing locally:
  missingTxs: Set<string>

  constructor (options: EngineStateOptions) {
    this.addressCache = {}
    this.txCache = {}
    this.connections = {}
    this.serverStates = {}
    this.txStates = {}
    this.missingTxs = new Set()

    this.bcoin = options.io
    this.io = options.io
    this.localFolder = options.localFolder
  }

  addAddress (scriptHash: string, displayAddress: string, path: string) {
    if (this.addressCache[scriptHash]) return

    this.addressCache[scriptHash] = {
      txids: [],
      txidStratumHash: '',
      utxos: [],
      utxoStratumHash: '',
      used: false,
      displayAddress,
      path
    }
  }

  connect () {
    this.engineStarted = true
    this.refillServers()
  }

  disconnect () {
    this.engineStarted = false
    for (const uri of Object.keys(this.connections)) {
      this.connections[uri].close()
      delete this.connections[uri]
    }
  }

  // ------------------------------------------------------------------------
  // Static stuff
  // ------------------------------------------------------------------------
  bcoin: any
  io: any
  localFolder: any

  refillServers () {
    while (Object.keys(this.connections).length < 5) {
      const uri = 'blah' // pickServerUri(serverCache, connections)
      const callbacks: StratumCallbacks = {
        onOpen: (uri: string) => {
          console.log(`Connected to ${uri}`)
        },

        onClose: (uri: string) => {
          console.log(`Disconnected from ${uri}`)
          delete this.connections[uri]
          if (this.engineStarted) this.refillServers()
        },

        onQueueSpace: (uri: string) => {
          return this.pickNextTask(uri)
        }
      }

      this.connections[uri] = new StratumConnection(uri, { callbacks })
    }
  }

  pickNextTask (uri: string) {}
}
