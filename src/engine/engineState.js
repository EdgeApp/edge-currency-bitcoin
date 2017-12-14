// @flow
import type { AbcIo, DiskletFolder } from 'airbitz-core-types'

import type { PluginState } from '../plugin/pluginState.js'
import type {
  StratumCallbacks,
  StratumTask
} from '../stratum/stratumConnection.js'
import { StratumConnection } from '../stratum/stratumConnection.js'
import {
  broadcastTx,
  fetchScriptHashHistory,
  fetchScriptHashUtxo,
  fetchTransaction,
  fetchVersion,
  subscribeHeight,
  subscribeScriptHash
} from '../stratum/stratumMessages.js'
import type {
  StratumBlockHeader,
  StratumHistoryRow,
  StratumUtxo
} from '../stratum/stratumMessages.js'

export type UtxoInfo = {
  txid: string, // tx_hash from Stratum
  index: number, // tx_pos from Stratum
  value: number // Satoshis fit in a number
}

export type AddressInfo = {
  txids: Array<string>,
  txidStratumHash: string,

  utxos: Array<UtxoInfo>,
  utxoStratumHash: string,

  used: boolean, // Set by `addGapLimitAddress`
  displayAddress: string, // base58 or other wallet-ready format
  path: string // TODO: Define the contents of this member.
}

export type AddressInfos = {
  [scriptHash: string]: AddressInfo
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
  io: any;
  localFolder: any;
  encryptedLocalFolder: any;
  pluginState: PluginState;
}

function nop () {}

const TIME_LAZINESS = 10000

/**
 * This object holds the current state of the wallet engine.
 * It is responsible for staying connected to Stratum servers and keeping
 * this information up to date.
 */
export class EngineState {
  // On-disk address information:
  addressCache: AddressInfos

  // On-disk hex transaction data:
  txCache: { [txid: string]: string }

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
  connections: { [uri: string]: StratumConnection }

  // Status of active Stratum connections:
  serverStates: {
    [uri: string]: {
      fetchingHeight: boolean,
      fetchingVersion: boolean,

      // The server block height:
      // undefined - never subscribed
      // 0 - subscribed but no results yet
      // number - subscription result
      height: number | void,
      version: string | void,

      // Address subscriptions:
      addresses: {
        [scriptHash: string]: {
          subscribed: boolean,

          hash: string | null,
          // Timestamp of the last hash change.
          // The server with the latest timestamp "owns" an address for the sake
          // of fetching utxos and txids:
          lastUpdate: number,

          fetchingUtxos: boolean,
          fetchingTxids: boolean,
          subscribing: boolean
        }
      },

      // All txids this server knows about (from subscribes or whatever):
      // Servers that know about txids are eligible to fetch those txs.
      // If no server knows about a txid, anybody can try fetching it,
      // but there is no penalty for failing:
      txids: { [txid: string]: true }
    }
  }

  // True if somebody is currently fetching a transaction:
  fetchingTxs: { [txid: string]: boolean }

  // Transactions that are relevant to our addresses, but missing locally:
  missingTxs: { [txid: string]: true }

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

    this.dirtyAddressCache()
    for (const uri of Object.keys(this.serverStates)) {
      this.serverStates[uri].addresses[scriptHash] = {
        fetchingTxids: false,
        fetchingUtxos: false,
        hash: null,
        lastUpdate: 0,
        subscribed: false,
        subscribing: false
      }
    }
  }

  async saveKeys (keys: any) {
    try {
      const json = JSON.stringify({ keys: keys })
      await this.encryptedLocalFolder.file('keys.json').setText(json)
      this.io.console.info('Saved keys cache')
    } catch (e) {
      console.error('Error saving Keys', e)
    }
  }

  async loadKeys () {
    try {
      const keysCacheText = await this.encryptedLocalFolder
        .file('keys.json')
        .getText()
      const keysCacheJson = JSON.parse(keysCacheText)
      // TODO: Validate JSON
      return keysCacheJson.keys
    } catch (e) {
      console.log(e)
      return {}
    }
  }

  broadcastTx (rawTx: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const uris = Object.keys(this.connections)
      let resolved = false
      let bad = 0

      const task = broadcastTx(
        rawTx,
        (txid: string) => {
          // We resolve if any server succeeds:
          if (!resolved) {
            resolved = true
            resolve(txid)
          }
        },
        (e: Error) => {
          // We fail if every server failed:
          if (++bad === uris.length) reject(e)
        }
      )

      for (const uri of uris) {
        const connection = this.connections[uri]
        connection.submitTask(task)
      }
    })
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
  io: AbcIo
  localFolder: DiskletFolder
  encryptedLocalFolder: DiskletFolder
  pluginState: PluginState
  onHeightUpdated: (height: number) => void
  onTxFetched: (txid: string) => void
  onTxidsUpdated: (addressHash: string) => void
  onUtxosUpdated: (addressHash: string) => void

  addressCacheDirty: boolean
  addressCacheTimestamp: number
  txCacheDirty: boolean
  txCacheTimestamp: number

  constructor (options: EngineStateOptions) {
    this.addressCache = {}
    this.txCache = {}
    this.txHeightCache = {}
    this.connections = {}
    this.serverStates = {}
    this.fetchingTxs = {}
    this.missingTxs = {}

    this.io = options.io
    this.localFolder = options.localFolder
    this.encryptedLocalFolder = options.encryptedLocalFolder
    this.pluginState = options.pluginState
    const {
      onHeightUpdated = nop,
      onUtxosUpdated = nop,
      onTxidsUpdated = nop,
      onTxFetched = nop
    } = options.callbacks
    this.onHeightUpdated = onHeightUpdated
    this.onTxFetched = onTxFetched
    this.onTxidsUpdated = onTxidsUpdated
    this.onUtxosUpdated = onUtxosUpdated

    this.addressCacheDirty = false
    this.addressCacheTimestamp = Date.now()
    this.txCacheDirty = false
    this.txCacheTimestamp = Date.now()
  }

  refillServers () {
    const { io } = this

    let i = 0
    const servers = this.pluginState
      .sortStratumServers(this.io.Socket != null, this.io.TLSSocket != null)
      .filter(uri => !this.connections[uri])
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
          if (this.addressCacheDirty) {
            this.saveAddressCache().catch(e =>
              console.error('saveAddressCache', e.message)
            )
          }
          if (this.txCacheDirty) {
            this.saveTxCache().catch(e =>
              console.error('saveTxCache', e.message)
            )
          }
        },

        onQueueSpace: uri => {
          // const start = Date.now()
          const task = this.pickNextTask(uri)
          // console.log(`bench: Picked task in ${Date.now() - start}ms`)
          return task
        },

        onNotifyHeader: (uri: string, headerInfo: StratumBlockHeader) => {
          this.serverStates[uri].height = headerInfo.block_height
          this.pluginState.updateHeight(headerInfo.block_height)
        },

        onNotifyScriptHash: (uri: string, scriptHash: string, hash: string) => {
          const addressState = this.serverStates[uri].addresses[scriptHash]
          addressState.hash = hash
          addressState.lastUpdate = Date.now()
        }
      }

      this.connections[uri] = new StratumConnection(uri, { callbacks, io })
      this.serverStates[uri] = {
        fetchingHeight: false,
        fetchingVersion: false,
        height: void 0,
        version: void 0,
        addresses: {},
        txids: new Set()
      }
      this.populateServerAddresses(uri)
      this.connections[uri].open()
    }
  }

  pickNextTask (uri: string): StratumTask | void {
    const serverState = this.serverStates[uri]

    // Check the version if we haven't done that already:
    if (serverState.version === void 0 && !serverState.fetchingVersion) {
      serverState.fetchingVersion = true
      return fetchVersion(
        (version: string) => {
          console.log(`Stratum ${uri} sent version ${version}`)
          serverState.fetchingVersion = false
          serverState.version = version
        },
        (e: Error) => {
          serverState.fetchingVersion = false
          this.onConnectionFail(uri, e, 'getting version')
        }
      )
    }

    // Subscribe to height if this has never happened:
    if (serverState.height === void 0 && !serverState.fetchingHeight) {
      serverState.fetchingHeight = true
      return subscribeHeight(
        (height: number) => {
          console.log(`Stratum ${uri} sent height ${height}`)
          serverState.fetchingHeight = false
          serverState.height = height
          this.pluginState.updateHeight(height)
        },
        (e: Error) => {
          serverState.fetchingHeight = false
          this.onConnectionFail(uri, e, 'subscribing to height')
        }
      )
    }

    // If this server is too old, bail out!
    // TODO: Stop checking the height in the Stratum message creator.
    // TODO: Check block headers to ensure we are on the right chain.
    if (!serverState.version) return
    if (serverState.version < '1.1') {
      this.connections[uri].close()
      return
    }

    // Fetch txids:
    for (const txid of Object.keys(this.missingTxs)) {
      if (!this.fetchingTxs[txid] && this.serverCanGetTx(uri, txid)) {
        this.fetchingTxs[txid] = true
        return fetchTransaction(
          txid,
          (txData: string) => {
            console.log(`Stratum ${uri} sent tx ${txid}`)
            this.fetchingTxs[txid] = false
            this.handleTxFetch(txid, txData)
          },
          (e: Error) => {
            this.fetchingTxs[txid] = false
            if (!serverState.txids[txid]) {
              this.onConnectionFail(uri, e, 'getting transaction')
            } else {
              // TODO: Don't penalize the server score either.
            }
          }
        )
      }
    }

    // Fetch utxos:
    for (const address of Object.keys(serverState.addresses)) {
      const addressState = serverState.addresses[address]
      if (
        addressState.hash &&
        addressState.hash !== this.addressCache[address].utxoStratumHash &&
        !addressState.fetchingUtxos &&
        this.findBestServer(address) === uri
      ) {
        addressState.fetchingUtxos = true
        return fetchScriptHashUtxo(
          address,
          (utxos: Array<StratumUtxo>) => {
            console.log(`Stratum ${uri} sent utxos for ${address}`)
            addressState.fetchingUtxos = false
            if (!addressState.hash) {
              throw new Error(
                'Blank stratum hash (logic bug - should never happen)'
              )
            }
            this.handleUtxoFetch(address, addressState.hash, utxos)
          },
          (e: Error) => {
            addressState.fetchingUtxos = false
            this.onConnectionFail(uri, e, 'fetching utxos')
          }
        )
      }
    }

    // Subscribe to addresses:
    for (const address of Object.keys(this.addressCache)) {
      const addressState = serverState.addresses[address]
      if (!addressState.subscribed && !addressState.subscribing) {
        addressState.subscribing = true
        return subscribeScriptHash(
          address,
          (hash: string | null) => {
            console.log(
              `Stratum ${uri} subscribed to ${address} at ${hash || 'null'}`
            )
            addressState.subscribing = false
            addressState.subscribed = true
            addressState.hash = hash
            addressState.lastUpdate = Date.now()
          },
          (e: Error) => {
            addressState.subscribing = false
            this.onConnectionFail(uri, e, 'subscribing to address')
          }
        )
      }
    }

    // Fetch history:
    for (const address of Object.keys(serverState.addresses)) {
      const addressState = serverState.addresses[address]
      if (
        addressState.hash &&
        addressState.hash !== this.addressCache[address].txidStratumHash &&
        !addressState.fetchingTxids &&
        this.findBestServer(address) === uri
      ) {
        addressState.fetchingTxids = true
        return fetchScriptHashHistory(
          address,
          (history: Array<StratumHistoryRow>) => {
            console.log(`Stratum ${uri} sent history for ${address}`)
            addressState.fetchingTxids = false
            if (!addressState.hash) {
              throw new Error(
                'Blank stratum hash (logic bug - should never happen)'
              )
            }
            this.handleHistoryFetch(address, addressState.hash, history)
          },
          (e: Error) => {
            addressState.fetchingTxids = false
            this.onConnectionFail(uri, e, 'getting history')
          }
        )
      }
    }
  }

  async load () {
    this.io.console.info('Loading wallet engine caches')

    // Load the address and height caches:
    try {
      const cacheText = await this.localFolder.file('addresses.json').getText()
      const cacheJson = JSON.parse(cacheText)

      // TODO: Validate JSON
      if (!cacheJson.addresses) throw new Error('Missing addresses in cache')
      if (!cacheJson.heights) throw new Error('Missing heights in cache')

      // Update the cache:
      this.addressCacheTimestamp = Date.now()
      this.addressCache = cacheJson.addresses
      this.txHeightCache = cacheJson.heights

      // Update the derived information:
      for (const scriptHash of Object.keys(this.addressCache)) {
        const address = this.addressCache[scriptHash]
        for (const txid of address.txids) this.handleNewTxid(txid)
        for (const utxo of address.utxos) this.handleNewTxid(utxo.txid)
      }
    } catch (e) {
      this.addressCache = {}
      this.txHeightCache = {}
    }

    // Load transaction data cache:
    try {
      const txCacheText = await this.localFolder.file('txs.json').getText()
      const txCacheJson = JSON.parse(txCacheText)

      // TODO: Validate JSON
      if (!txCacheJson.txs) throw new Error('Missing txs in cache')

      // Update the cache:
      this.txCacheTimestamp = Date.now()
      this.txCache = txCacheJson.txs
    } catch (e) {
      this.txCache = {}
    }

    return this
  }

  saveAddressCache () {
    const json = JSON.stringify({
      addresses: this.addressCache,
      heights: this.txHeightCache
    })

    this.io.console.info('Saving address cache')
    return this.localFolder
      .file('addresses.json')
      .setText(json)
      .then(() => {
        this.addressCacheDirty = false
        this.addressCacheTimestamp = Date.now()
      })
  }

  saveTxCache () {
    const json = JSON.stringify({ txs: this.txCache })

    this.io.console.info('Saving tx cache')
    return this.localFolder
      .file('txs.json')
      .setText(json)
      .then(() => {
        this.txCacheDirty = false
        this.txCacheTimestamp = Date.now()
      })
  }

  dirtyAddressCache () {
    this.addressCacheDirty = true
    if (this.addressCacheTimestamp + TIME_LAZINESS < Date.now()) {
      this.saveAddressCache().catch(e => console.error(e))
    }
  }

  dirtyTxCache () {
    this.txCacheDirty = true
    if (this.txCacheTimestamp + TIME_LAZINESS < Date.now()) {
      this.saveTxCache().catch(e => console.error(e))
    }
  }

  findBestServer (address: string) {
    let bestTime = 0
    let bestUri = ''
    for (const uri of Object.keys(this.connections)) {
      const time = this.serverStates[uri].addresses[address].lastUpdate
      if (bestTime < time) {
        bestTime = time
        bestUri = uri
      }
    }
    return bestUri
  }

  serverCanGetTx (uri: string, txid: string) {
    // If we have it, we can get it:
    if (this.serverStates[uri].txids[txid]) return true

    // If somebody else has it, let them get it:
    for (const uri of Object.keys(this.connections)) {
      if (this.serverStates[uri].txids[txid]) return false
    }

    // If nobody has it, we can try getting it:
    return true
  }

  // A server has sent address history data, so update the caches:
  handleHistoryFetch (
    scriptHash: string,
    stateHash: string,
    history: Array<StratumHistoryRow>
  ) {
    // Process the txid list:
    const txidList: Array<string> = []
    for (const row of history) {
      txidList.push(row.tx_hash)
      this.handleTxidFetch(row.tx_hash, row.height)
    }

    // Save to the address cache:
    this.addressCache[scriptHash].txids = txidList
    this.addressCache[scriptHash].txidStratumHash = stateHash
    this.dirtyAddressCache()
    this.onTxidsUpdated(scriptHash)
  }

  // A server has sent a transaction, so update the caches:
  handleTxFetch (txid: string, txData: string) {
    this.txCache[txid] = txData
    delete this.missingTxs[txid]
    this.dirtyTxCache()
    this.onTxFetched(txid)
  }

  // A server has told us about a txid, so update the caches:
  handleTxidFetch (txid: string, height: number) {
    // Save to the height cache:
    if (this.txHeightCache[txid]) {
      this.txHeightCache[txid].height = height
    } else {
      this.txHeightCache[txid] = {
        firstSeen: Date.now(),
        height
      }
    }

    this.handleNewTxid(txid)
  }

  // Someone has detected a potentially new txid, so update tables:
  handleNewTxid (txid: string) {
    // Add to the relevant txid list:
    if (typeof this.fetchingTxs[txid] !== 'boolean') {
      this.fetchingTxs[txid] = false
    }

    // Add to the missing tx list:
    if (!this.txCache[txid]) {
      this.missingTxs[txid] = true
    }
  }

  // A server has sent UTXO data, so update the caches:
  handleUtxoFetch (
    scriptHash: string,
    stateHash: string,
    utxos: Array<StratumUtxo>
  ) {
    // Process the UTXO list:
    const utxoList: Array<UtxoInfo> = []
    for (const utxo of utxos) {
      utxoList.push({
        txid: utxo.tx_hash,
        index: utxo.tx_pos,
        value: utxo.value
      })
      this.handleTxidFetch(utxo.tx_hash, utxo.height)
    }

    // Save to the address cache:
    this.addressCache[scriptHash].utxos = utxoList
    this.addressCache[scriptHash].utxoStratumHash = stateHash
    this.dirtyAddressCache()
    this.onUtxosUpdated(scriptHash)
  }

  onConnectionFail (uri: string, e: Error, task: string) {
    console.info(
      `Stratum ${uri} failed with message "${e.message}" while ${task}`
    )
    if (this.connections[uri]) {
      this.connections[uri].close()
    }
  }

  populateServerAddresses (uri: string) {
    const serverState = this.serverStates[uri]
    for (const address of Object.keys(this.addressCache)) {
      if (!serverState.addresses[address]) {
        serverState.addresses[address] = {
          fetchingTxids: false,
          fetchingUtxos: false,
          hash: null,
          lastUpdate: 0,
          subscribed: false,
          subscribing: false
        }
      }
    }
  }
}
