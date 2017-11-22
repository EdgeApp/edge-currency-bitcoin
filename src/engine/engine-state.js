// @flow
import type { AbcIo, DiskletFolder } from 'airbitz-core-types'

import type { PluginState } from '../plugin/plugin-state.js'
import type { StratumCallbacks } from '../stratum/stratum-connection.js'
import { StratumConnection } from '../stratum/stratum-connection.js'
import { subscribeHeight } from '../stratum/stratum-messages'

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

export interface EngineStateCallbacks {
  // Changes to the address cache (might also affect tx heights):
  +onUtxosUpdated?: (addressHash: string) => void;
  +onTxidsUpdated?: (addressHash: string) => void;

  // Changes to the chain height:
  +onHeightUpdated?: (height: number) => void;

  // Fetched a transaction from the network:
  +onTxFetched?: (txid: string) => void;
}

export interface EngineStateOptions {
  callbacks: EngineStateCallbacks;
  bcoin: any;
  io: any;
  localFolder: any;
  pluginState: PluginState;
}

function nop () {}

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
    [txid: string]: string // hex string data
  }

  // Transaction height / timestamps:
  txHeightCache: {
    [txid: string]: {
      height: number,
      firstSeen: number // Timestamp for unconfirmed stuff
    }
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
    this.pluginState = options.pluginState
    const { onHeightUpdated = nop } = options.callbacks
    this.onHeightUpdated = onHeightUpdated

    this.bcoin = options.bcoin
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

    this.save()
  }

  connect () {
    this.pluginState.addEngine(this)
    this.engineStarted = true
    this.refillServers()
  }

  disconnect () {
    this.pluginState.removeEngine(this)
    this.engineStarted = false
    for (const uri of Object.keys(this.connections)) {
      this.connections[uri].close()
      delete this.connections[uri]
    }
  }

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------
  bcoin: any
  io: AbcIo
  localFolder: DiskletFolder
  pluginState: PluginState
  onHeightUpdated: (height: number) => void

  refillServers () {
    const { io } = this

    let i = 0
    const servers = this.pluginState.sortStratumServers(
      this.io.Socket !== null,
      this.io.TLSSocket !== null
    )
    while (Object.keys(this.connections).length < 5) {
      const uri = servers[i++]
      if (!uri) break

      const callbacks: StratumCallbacks = {
        onOpen: (uri: string) => {
          console.log(`Connected to ${uri}`)
        },

        onClose: (
          uri: string,
          badMessages: number,
          goodMessages: number,
          latency: number,
          error?: Error
        ) => {
          console.log(`Disconnected from ${uri}`)
          delete this.connections[uri]
          this.pluginState.serverDisconnected(
            uri,
            badMessages,
            error != null,
            goodMessages,
            latency
          )
          if (this.engineStarted) this.refillServers()
        },

        onQueueSpace: (uri: string) => {
          return this.pickNextTask(uri)
        }
      }

      this.connections[uri] = new StratumConnection(uri, { callbacks, io })
      this.serverStates[uri] = {
        height: void 0,
        addresses: {},
        txids: new Set()
      }
      this.connections[uri].open()
    }
  }

  pickNextTask (uri: string) {
    const serverState = this.serverStates[uri]

    // Subscribe to height if this has never happened:
    if (serverState.height === void 0) {
      serverState.height = 0
      return subscribeHeight(
        (height: number) => {
          console.log(`Stratum ${uri} sent height ${height}`)
          serverState.height = height
          if (this.pluginState.height < height) {
            this.pluginState.height = height
            this.onHeightUpdated(height)
          }
        },
        (e: Error) => {
          console.error(e)
          this.connections[uri].close()
        }
      )
    }
  }

  async load () {
    try {
      const cacheText = await this.localFolder.file('addresses.json').getText()
      const cacheJson = JSON.parse(cacheText)
      // TODO: Validate JSON

      this.addressCache = cacheJson.addresses
      this.txHeightCache = cacheJson.heights
    } catch (e) {
      this.addressCache = {}
      this.txHeightCache = {}
    }

    try {
      const txCacheText = await this.localFolder.file('txs.json').getText()
      const txCacheJson = JSON.parse(txCacheText)
      // TODO: Validate JSON

      this.txCache = txCacheJson.txs
    } catch (e) {
      this.txCache = {}
    }

    return this
  }

  async save () {
    await this.localFolder.file('addressses.json').setText(
      JSON.stringify({
        addresses: this.addressCache,
        heights: this.txHeightCache
      })
    )

    await this.localFolder
      .file('txs.json')
      .setText(JSON.stringify({ txs: this.txCache }))
  }
}
