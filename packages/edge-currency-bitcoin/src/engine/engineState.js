// @flow

import { type Disklet } from 'disklet'
import EventEmitter from 'eventemitter3'
import { type HDKeyPair } from 'nidavellir'
import { parse } from 'uri-js'

import {
  type AddressInfos,
  type AddressState,
  type EngineStateOptions,
  type UtxoInfo
} from '../../types/engine.js'
import { type PluginIo } from '../../types/plugin.js'
import {
  type StratumBlockHeader,
  type StratumCallbacks,
  type StratumHistoryRow,
  type StratumTask,
  type StratumUtxo
} from '../../types/stratum.js'
import { type PluginState } from '../plugin/pluginState.js'
import { StratumConnection } from '../stratum/stratumConnection.js'
import {
  broadcastTx,
  fetchBlockHeader,
  fetchScriptHashHistory,
  fetchScriptHashUtxo,
  fetchTransaction,
  subscribeHeight,
  subscribeScriptHash
} from '../stratum/stratumMessages.js'
import { parseTransaction } from '../utils/bcoinUtils/tx.js'
import { pushUpdate, removeIdFromQueue } from '../utils/updateQueue.js'
import { cache } from '../utils/utils.js'

function nop() {}

const CACHE_THROTTLE = 0.25
const MAX_CONNECTIONS = 2
const NEW_CONNECTIONS = 8

/**
 * This object holds the current state of the wallet engine.
 * It is responsible for staying connected to Stratum servers and keeping
 * this information up to date.
 */
export class EngineState extends EventEmitter {
  // On-disk address information:
  addresses: {
    [scriptHash: string]: {
      txids: Array<string>,
      txidStratumHash: string,

      utxos: Array<UtxoInfo>,
      utxoStratumHash: string,

      displayAddress: string, // base58 or other wallet-ready format
      path: string, // TODO: Define the contents of this member.

      redeemScript?: string // Allows for saving generic P2SH addresses
    }
  }

  // Derived address information:
  addressInfos: AddressInfos

  // Maps from display addresses to script hashes:
  scriptHashes: { [displayAddress: string]: string }

  // Address usage information sent by the GUI:
  usedAddresses: { [scriptHash: string]: true }

  // On-disk hex transaction data:
  txs: { [txid: string]: string }

  // Transaction height / Timestamp:
  txHeights: {
    [txid: string]: {
      height: number,
      firstSeen: number // Timestamp for unconfirmed stuff
    }
  }

  masterKey: HDKeyPair

  // Cache of parsed transaction data:
  parsedTxs: { [txid: string]: any }

  // True if `startEngine` has been called:
  engineStarted: boolean

  // Active Stratum connection objects:
  connections: { [uri: string]: StratumConnection }

  // Status of active Stratum connections:
  serverStates: {
    [uri: string]: {
      fetchingHeight: boolean,

      // The server block height:
      // undefined - never subscribed
      // 0 - subscribed but no results yet
      // number - subscription result
      height: number | void,

      // Address subscriptions:
      addresses: { [scriptHash: string]: AddressState },

      // All txids this server knows about (from subscribes or whatever):
      // Servers that know about txids are eligible to fetch those txs.
      // If no server knows about a txid, anybody can try fetching it,
      // but there is no penalty for failing:
      txids: { [txid: string]: true },

      // All block headers this server knows about (from subscribes or whatever):
      // Servers that know about headers are eligible to fetch those headers.
      // If no server knows about a height, anybody can try fetching it,
      // but there is no penalty for failing:
      headers: { [height: string]: true }
    }
  }

  // True if somebody is currently fetching a transaction:
  fetchingTxs: { [txid: string]: boolean }

  // Transactions that are relevant to our addresses, but missing locally:
  missingTxs: { [txid: string]: true }

  // True if somebody is currently fetching a transaction:
  fetchingHeaders: { [height: string]: boolean }

  // Headers that are relevant to our transactions, but missing locally:
  missingHeaders: { [height: string]: true }

  addAddress(
    scriptHash: string,
    displayAddress: string,
    path: string,
    redeemScript?: string
  ) {
    if (this.addresses[scriptHash]) return

    this.addresses[scriptHash] = {
      txids: [],
      txidStratumHash: '',
      utxos: [],
      utxoStratumHash: '',
      displayAddress,
      path,
      redeemScript
    }

    this.refreshAddressInfo(scriptHash)

    for (const uri of Object.keys(this.serverStates)) {
      this.serverStates[uri].addresses[scriptHash] = {
        fetchingTxids: false,
        fetchingUtxos: false,
        hash: null,
        lastUpdate: 0,
        subscribed: false,
        subscribing: false,
        synced: false
      }
    }
  }

  markAddressesUsed(scriptHashes: Array<string>) {
    for (const scriptHash of scriptHashes) {
      this.usedAddresses[scriptHash] = true
      this.refreshAddressInfo(scriptHash)
    }
  }

  broadcastTx(rawTx: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const uris = Object.keys(this.connections).filter(
        uri => this.connections[uri].connected
      )
      // If we have no connections then error
      if (!uris || !uris.length) {
        reject(
          new Error('No available connections\nCheck your internet signal')
        )
      }
      let resolved = false
      let bad = 0

      const task = broadcastTx(
        rawTx,
        (txid: string) => {
          console.log(`${this.walletId}: broadcastTx success: ${txid}`)
          // We resolve if any server succeeds:
          if (!resolved) {
            resolved = true
            resolve(txid)
          }
        },
        (e?: Error) => {
          // We fail if every server failed:
          if (++bad === uris.length) {
            const msg = e ? `With error ${e.toString()}` : ''
            console.log(`${this.walletId} broadcastTx fail: ${rawTx}\n${msg}}`)
            reject(e)
          }
        }
      )

      for (const uri of uris) {
        const connection = this.connections[uri]
        connection.submitTask(task)
      }
    })
  }

  /**
   * Called to complete a spend
   */
  saveTx(txid: string, rawTx: string) {
    this.handleTxidFetch(txid, -1)
    this.handleTxFetch(txid, rawTx)

    // Update the affected addresses:
    for (const scriptHash of this.findAffectedAddresses(txid)) {
      this.addresses[scriptHash].txids.push(txid)
      this.refreshAddressInfo(scriptHash)
    }
  }

  connect() {
    this.progressRatio = 0
    this.txCacheInitSize = Object.keys(this.txs).length
    this.engineStarted = true
    this.pluginState.addEngine(this)
    this.refillServers()
  }

  async disconnect() {
    removeIdFromQueue(this.walletId)
    this.pluginState.removeEngine(this)
    this.engineStarted = false
    this.progressRatio = 0
    clearTimeout(this.reconnectTimer)
    const closed = [
      // $FlowFixMe
      this.masterKey('stop'),
      // $FlowFixMe
      this.txs('stop'),
      // $FlowFixMe
      this.addresses('stop'),
      // $FlowFixMe
      this.txHeights('stop')
    ]
    for (const uri of Object.keys(this.connections)) {
      closed.push(
        new Promise((resolve, reject) => {
          this.on('connectionClose', uriClosed => {
            if (uriClosed === uri) resolve()
          })
        })
      )
      this.connections[uri].disconnect()
    }
    await Promise.all(closed)
  }

  getBalance(options: any): string {
    return Object.keys(this.addressInfos)
      .reduce((total, scriptHash) => {
        const { balance } = this.addressInfos[scriptHash]
        return total + balance
      }, 0)
      .toString()
  }

  getUTXOs() {
    const utxos: any = []
    for (const scriptHash in this.addressInfos) {
      const utxoLength = this.addressInfos[scriptHash].utxos.length
      for (let i = 0; i < utxoLength; i++) {
        const utxo = this.addressInfos[scriptHash].utxos[i]
        const { txid, index } = utxo
        let height = -1
        if (this.txHeights[txid]) {
          height = this.txHeights[txid].height
        }
        const tx = this.parsedTxs[txid] || {}
        utxos.push({ index, tx, height })
      }
    }
    return utxos
  }

  getNumTransactions(options: any): number {
    return Object.keys(this.txs).length
  }

  dumpData(): any {
    return {
      'engineState.addresses': this.addresses,
      'engineState.addressInfos': this.addressInfos,
      'engineState.scriptHashes': this.scriptHashes,
      'engineState.scriptHashesMap': this.scriptHashesMap,
      'engineState.usedAddresses': this.usedAddresses,
      'engineState.txs': this.txs,
      'engineState.txHeights': this.txHeights,
      'engineState.missingHeaders': this.missingHeaders,
      'engineState.serverStates': this.serverStates,
      'engineState.fetchingTxs': this.fetchingTxs,
      'engineState.missingTxs': this.missingTxs,
      'engineState.fetchingHeader': this.fetchingHeaders
    }
  }

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------
  io: PluginIo
  walletId: string
  localFolder: Disklet
  encryptedLocalFolder: Disklet
  pluginState: PluginState
  onBalanceChanged: () => void
  onAddressUsed: () => void
  onHeightUpdated: (height: number) => void
  onTxFetched: (txid: string) => void
  onAddressesChecked: (progressRatio: number) => void

  reconnectTimer: TimeoutID
  reconnectCounter: number
  progressRatio: number
  txCacheInitSize: number
  serverList: Array<string>

  constructor(options: EngineStateOptions) {
    super()
    this.addressInfos = {}
    this.scriptHashes = {}
    this.scriptHashesMap = {}
    this.usedAddresses = {}

    this.connections = {}
    this.serverStates = {}
    this.fetchingTxs = {}
    this.missingTxs = {}
    this.fetchingHeaders = {}
    this.missingHeaders = {}
    this.parsedTxs = {}

    // $FlowFixMe
    this.masterKey = () => {}
    // $FlowFixMe
    this.txs = () => {}
    // $FlowFixMe
    this.addresses = () => {}
    // $FlowFixMe
    this.txHeights = () => {}

    this.walletId = options.walletId || ''
    this.io = options.io
    this.localDisklet = options.localDisklet
    this.encryptedLocalDisklet = options.encryptedLocalDisklet
    this.pluginState = options.pluginState
    this.serverList = []
    const {
      onBalanceChanged = nop,
      onAddressUsed = nop,
      onHeightUpdated = nop,
      onTxFetched = nop,
      onAddressesChecked = nop
    } = options.callbacks
    this.onBalanceChanged = onBalanceChanged
    this.onAddressUsed = onAddressUsed
    this.onHeightUpdated = onHeightUpdated
    this.onTxFetched = onTxFetched
    this.onAddressesChecked = onAddressesChecked

    this.reconnectCounter = 0
    this.progressRatio = 0
    this.txCacheInitSize = 0
  }

  async load() {
    console.log(`${this.walletId} - Loading wallet engine caches`)
    // Load Master Key from disk:
    this.masterKey = await cache(
      this.encryptedLocalDisklet,
      'keys',
      this.walletId
    )
    // Load transaction data cache:
    this.txs = await cache(this.localDisklet, 'txs', this.walletId)
    // Update the derived information:
    for (const txid of Object.keys(this.txs)) {
      this.parsedTxs[txid] = parseTransaction(this.txs[txid])
    }
    // Load the address and height caches.
    // Must come after transactions are loaded for proper txid filtering:
    this.addresses = await cache(this.localDisklet, 'addresses', this.walletId)
    this.txHeights = await cache(this.localDisklet, 'txHeights', this.walletId)
    // Fill up the missing headers to fetch
    for (const txid in this.txHeights) {
      const height = this.txHeights[txid].height
      if (height > 0 && !this.pluginState.headers[`${height}`]) {
        this.missingHeaders[`${height}`] = true
      }
    }
    // Update the derived information:
    for (const scriptHash in this.addresses) {
      const address = this.addresses[scriptHash]
      const { displayAddress, path } = address
      this.scriptHashes[displayAddress] = scriptHash
      const pathArr = path.split('/')
      const indexStr = pathArr.pop()
      const index = parseInt(indexStr)
      const parentPath = pathArr.join('/')
      if (!this.scriptHashesMap[parentPath]) {
        this.scriptHashesMap[parentPath] = []
      }
      this.scriptHashesMap[parentPath][index] = scriptHash
      for (const txid of address.txids) this.handleNewTxid(txid)
      for (const utxo of address.utxos) this.handleNewTxid(utxo.txid)
      this.refreshAddressInfo(scriptHash)
    }
    return this
  }

  async clearCache() {
    // $FlowFixMe
    await this.masterKey({})
    // $FlowFixMe
    await this.txs({})
    // $FlowFixMe
    await this.addresses({})
    // $FlowFixMe
    await this.txHeights({})

    this.addressInfos = {}
    this.scriptHashes = {}
    this.scriptHashesMap = {}
    this.usedAddresses = {}
    this.parsedTxs = {}
    this.connections = {}
    this.serverStates = {}
    this.fetchingTxs = {}
    this.missingTxs = {}
    this.fetchingHeaders = {}
    this.missingHeaders = {}
  }

  reconnect() {
    if (this.engineStarted) {
      if (!this.reconnectTimer) {
        if (this.reconnectCounter < 5) this.reconnectCounter++
        this.reconnectTimer = setTimeout(() => {
          clearTimeout(this.reconnectTimer)
          delete this.reconnectTimer
          this.refillServers()
        }, this.reconnectCounter * 1000)
      } else {
      }
    }
  }

  updateProgressRatio() {
    if (this.progressRatio !== 1) {
      const fetchedTxsLen = Object.keys(this.txs).length
      const missingTxsLen = Object.keys(this.missingTxs).length
      const totalTxs = fetchedTxsLen + missingTxsLen - this.txCacheInitSize

      const scriptHashes = Object.keys(this.addresses)
      const totalAddresses = scriptHashes.length
      const syncedAddressesLen = scriptHashes.filter(scriptHash => {
        for (const uri in this.serverStates) {
          const address = this.serverStates[uri].addresses[scriptHash]
          if (address && address.synced) return true
        }
        return false
      }).length
      const missingAddressesLen = totalAddresses - syncedAddressesLen
      const allTasks = totalAddresses + totalTxs
      const missingTasks = missingTxsLen + missingAddressesLen
      const percent = (allTasks - missingTasks) / allTasks

      const percentDiff = percent - this.progressRatio
      if (percentDiff > CACHE_THROTTLE || percent === 1) {
        this.progressRatio = percent
        this.onAddressesChecked(this.progressRatio)
      }
    }
  }

  refillServers() {
    pushUpdate({
      id: this.walletId,
      updateFunc: () => {
        this.doRefillServers()
      }
    })
  }

  doRefillServers() {
    const { io } = this
    const ignorePatterns = []
    // if (!this.io.TLSSocket)
    ignorePatterns.push('electrums:')
    ignorePatterns.push('electrumwss:')
    if (this.serverList.length === 0) {
      this.serverList = this.pluginState.getServers(
        NEW_CONNECTIONS,
        ignorePatterns
      )
    }
    console.log(
      `${this.walletId} : refillServers: Top ${NEW_CONNECTIONS} servers:`,
      this.serverList
    )
    let chanceToBePicked = 1.25
    while (Object.keys(this.connections).length < MAX_CONNECTIONS) {
      if (!this.serverList.length) break
      const uri = this.serverList.shift()
      if (this.connections[uri]) {
        continue
      }
      // Validate the URI of server to make sure it is valid
      const parsed = parse(uri)
      if (
        !parsed.scheme ||
        parsed.scheme.length < 3 ||
        !parsed.host ||
        !parsed.port
      ) {
        continue
      }
      chanceToBePicked -= chanceToBePicked > 0.5 ? 0.25 : 0
      if (Math.random() > chanceToBePicked) {
        this.serverList.push(uri)
        continue
      }
      if (!uri) {
        this.reconnect()
        break
      }
      const prefix = `${this.walletId} ${uri.replace('electrum://', '')}:`
      const callbacks: StratumCallbacks = {
        onOpen: () => {
          this.reconnectCounter = 0
          console.log(`${prefix} ** Connected **`)
        },
        onClose: (error?: Error) => {
          delete this.connections[uri]
          const msg = error ? ` !! Connection ERROR !! ${error.message}` : ''
          console.log(`${prefix} onClose ${msg}`)
          this.emit('connectionClose', uri)
          error && this.pluginState.serverScoreDown(uri)
          this.reconnect()
        },

        onQueueSpace: () => {
          const task = this.pickNextTask(uri)
          if (task) {
            const taskMessage = task
              ? `${task.method} params: ${task.params.toString()}`
              : 'no task'
            console.log(`${prefix} nextTask: ${taskMessage}`)
          }
          return task
        },
        onTimer: (queryTime: number) => {
          console.log(`${prefix} returned version in ${queryTime}ms`)
          this.pluginState.serverScoreUp(uri, Date.now() - queryTime)
        },
        onVersion: (version: string, requestMs) => {
          console.log(`${prefix}received version ${version}`)
          this.pluginState.serverScoreUp(uri, requestMs)
        },
        onNotifyHeader: (headerInfo: StratumBlockHeader) => {
          console.log(`${prefix} returned height: ${headerInfo.block_height}`)
          this.serverStates[uri].height = headerInfo.block_height
          this.pluginState.updateHeight(headerInfo.block_height)
        },

        onNotifyScriptHash: (scriptHash: string, hash: string) => {
          console.log(`${prefix} notified scripthash change: ${scriptHash}`)
          const addressState = this.serverStates[uri].addresses[scriptHash]
          addressState.hash = hash
          addressState.lastUpdate = Date.now()
        }
      }

      this.connections[uri] = new StratumConnection(uri, {
        callbacks,
        io,
        walletId: this.walletId
      })
      this.serverStates[uri] = {
        fetchingHeight: false,
        height: undefined,
        addresses: {},
        txids: new Set(),
        headers: new Set()
      }
      this.populateServerAddresses(uri)
      this.connections[uri].open()
    }
  }

  pickNextTask(uri: string): StratumTask | void {
    const serverState = this.serverStates[uri]
    const connection = this.connections[uri]
    const prefix = `${this.walletId} ${uri.replace('electrum://', '')}:`

    // Subscribe to height if this has never happened:
    if (serverState.height === undefined && !serverState.fetchingHeight) {
      serverState.fetchingHeight = true
      const queryTime = Date.now()
      return subscribeHeight(
        (height: number) => {
          console.log(`${prefix} received height ${height}`)
          serverState.fetchingHeight = false
          serverState.height = height
          this.pluginState.updateHeight(height)
          this.pluginState.serverScoreUp(uri, Date.now() - queryTime)
        },
        (e: Error) => {
          serverState.fetchingHeight = false
          this.handleMessageError(uri, 'subscribing to height', e)
        }
      )
    }

    // If this server is too old, bail out!
    // TODO: Stop checking the height in the Stratum message creator.
    // TODO: Check block headers to ensure we are on the right chain.
    if (connection.version == null) return
    if (connection.version < '1.1') {
      this.connections[uri].handleError(
        new Error('Server protocol version is too old')
      )
      this.pluginState.serverScoreDown(uri, 100)
      return
    }

    // Fetch Headers:
    for (const height in this.missingHeaders) {
      if (
        !this.fetchingHeaders[height] &&
        this.serverCanGetHeader(uri, height)
      ) {
        this.fetchingHeaders[height] = true
        const queryTime = Date.now()
        return fetchBlockHeader(
          parseInt(height),
          (header: any) => {
            console.log(`${prefix} received header for block number ${height}`)
            this.fetchingHeaders[height] = false
            this.pluginState.serverScoreUp(uri, Date.now() - queryTime)
            this.handleHeaderFetch(height, header)
          },
          (e: Error) => {
            this.fetchingHeaders[height] = false
            if (!serverState.headers[height]) {
              this.handleMessageError(
                uri,
                `getting header for block number ${height}`,
                e
              )
            } else {
              // TODO: Don't penalize the server score either.
            }
          }
        )
      }
    }

    // Fetch txids:
    for (const txid in this.missingTxs) {
      if (!this.fetchingTxs[txid] && this.serverCanGetTx(uri, txid)) {
        this.fetchingTxs[txid] = true
        const queryTime = Date.now()
        return fetchTransaction(
          txid,
          (txData: string) => {
            console.log(`${prefix} ** RECEIVED TX ** ${txid}`)
            this.pluginState.serverScoreUp(uri, Date.now() - queryTime)
            this.fetchingTxs[txid] = false
            this.handleTxFetch(txid, txData)
            this.updateProgressRatio()
          },
          (e: Error) => {
            this.fetchingTxs[txid] = false
            if (!serverState.txids[txid]) {
              this.handleMessageError(uri, `getting transaction ${txid}`, e)
            } else {
              // TODO: Don't penalize the server score either.
            }
          }
        )
      }
    }

    // Fetch utxos:
    for (const scriptHash in serverState.addresses) {
      const addressState = serverState.addresses[scriptHash]
      if (
        addressState.hash &&
        addressState.hash !== this.addresses[scriptHash].utxoStratumHash &&
        !addressState.fetchingUtxos &&
        this.findBestServer(scriptHash) === uri
      ) {
        addressState.fetchingUtxos = true
        const queryTime = Date.now()
        return fetchScriptHashUtxo(
          scriptHash,
          (utxos: Array<StratumUtxo>) => {
            console.log(`${prefix} received utxos for: ${scriptHash}`)
            addressState.fetchingUtxos = false
            if (!addressState.hash) {
              throw new Error(
                'Blank stratum hash (logic bug - should never happen)'
              )
            }
            this.pluginState.serverScoreUp(uri, Date.now() - queryTime)
            this.handleUtxoFetch(scriptHash, addressState.hash || '', utxos)
          },
          (e: Error) => {
            addressState.fetchingUtxos = false
            this.handleMessageError(uri, `fetching utxos for: ${scriptHash}`, e)
          }
        )
      }
    }

    // Subscribe to addresses:
    for (const scriptHash in this.addressInfos) {
      const addressState = serverState.addresses[scriptHash]
      if (!addressState.subscribed && !addressState.subscribing) {
        addressState.subscribing = true
        const queryTime = Date.now()
        return subscribeScriptHash(
          scriptHash,
          (hash: string | null) => {
            console.log(
              `${prefix} subscribed to ${scriptHash} at ${
                hash ? hash.slice(0, 6) : 'null'
              }`
            )
            this.pluginState.serverScoreUp(uri, Date.now() - queryTime, 0)
            addressState.subscribing = false
            addressState.subscribed = true
            addressState.hash = hash
            addressState.lastUpdate = Date.now()
            const { txidStratumHash } = this.addresses[scriptHash]
            if (!hash || hash === txidStratumHash) {
              addressState.synced = true
              this.updateProgressRatio()
            }
          },
          (e: Error) => {
            addressState.subscribing = false
            this.handleMessageError(uri, `subscribing to ${scriptHash}`, e)
          }
        )
      }
    }

    // Fetch history:
    for (const scriptHash in serverState.addresses) {
      const addressState = serverState.addresses[scriptHash]
      if (
        addressState.hash &&
        addressState.hash !== this.addresses[scriptHash].txidStratumHash &&
        !addressState.fetchingTxids &&
        this.findBestServer(scriptHash) === uri
      ) {
        addressState.fetchingTxids = true
        const queryTime = Date.now()
        return fetchScriptHashHistory(
          scriptHash,
          (history: Array<StratumHistoryRow>) => {
            console.log(`${prefix}received history for ${scriptHash}`)
            addressState.fetchingTxids = false
            if (!addressState.hash) {
              throw new Error(
                'Blank stratum hash (logic bug - should never happen)'
              )
            }
            this.pluginState.serverScoreUp(uri, Date.now() - queryTime)
            this.handleHistoryFetch(scriptHash, addressState, history)
          },
          (e: Error) => {
            addressState.fetchingTxids = false
            this.handleMessageError(
              uri,
              `getting history for address ${scriptHash}`,
              e
            )
          }
        )
      }
    }
  }

  findBestServer(address: string) {
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

  serverCanGetTx(uri: string, txid: string) {
    // If we have it, we can get it:
    if (this.serverStates[uri].txids[txid]) return true

    // If somebody else has it, let them get it:
    for (const uri of Object.keys(this.connections)) {
      if (this.serverStates[uri].txids[txid]) return false
    }

    // If nobody has it, we can try getting it:
    return true
  }

  serverCanGetHeader(uri: string, height: string) {
    // If we have it, we can get it:
    if (this.serverStates[uri].headers[height]) return true

    // If somebody else has it, let them get it:
    for (const uri of Object.keys(this.connections)) {
      if (this.serverStates[uri].headers[height]) return false
    }

    // If nobody has it, we can try getting it:
    return true
  }

  // A server has sent a header, so update the cache and txs:
  handleHeaderFetch(height: string, header: any) {
    if (!this.pluginState.headers[height]) {
      this.pluginState.headers[height] = header
      const affectedTXIDS = this.findAffectedTransactions(height)
      for (const txid of affectedTXIDS) {
        if (this.parsedTxs[txid]) this.onTxFetched(txid)
      }
    }
    delete this.missingHeaders[height]
  }

  // A server has sent address history data, so update the caches:
  handleHistoryFetch(
    scriptHash: string,
    addressState: AddressState,
    history: Array<StratumHistoryRow>
  ) {
    // Process the txid list:
    const txidList: Array<string> = []
    for (const row of history) {
      txidList.push(row.tx_hash)
      this.handleTxidFetch(row.tx_hash, row.height)
    }

    // Save to the address cache:
    addressState.synced = true
    this.addresses[scriptHash].txids = txidList
    this.addresses[scriptHash].txidStratumHash = addressState.hash || ''
    this.updateProgressRatio()
    this.refreshAddressInfo(scriptHash)
  }

  // A server has sent a transaction, so update the caches:
  handleTxFetch(txid: string, txData: string) {
    this.txs[txid] = txData
    delete this.missingTxs[txid]
    this.parsedTxs[txid] = parseTransaction(txData)
    for (const scriptHash of this.findAffectedAddressesForInputs(txid)) {
      this.refreshAddressInfo(scriptHash)
    }
    this.onTxFetched(txid)
    for (const scriptHash of this.findAffectedAddressesForOutput(txid)) {
      this.refreshAddressInfo(scriptHash)
      for (const parsedTxid of this.addressInfos[scriptHash].txids) {
        const tx = this.parsedTxs[parsedTxid]
        for (const input of tx.inputs) {
          if (input.prevout) {
            const hash = input.prevout.rhash()
            if (hash === txid && this.parsedTxs[hash]) {
              this.onTxFetched(parsedTxid)
            }
          }
        }
      }
    }
  }

  // A server has told us about a txid, so update the caches:
  handleTxidFetch(txid: string, height: number) {
    height = height || -1
    // Save to the height cache:
    if (this.txHeights[txid]) {
      const prevHeight = this.txHeights[txid].height
      this.txHeights[txid].height = height
      if (
        this.parsedTxs[txid] &&
        (prevHeight === -1 || !prevHeight) &&
        height !== -1
      ) {
        this.onTxFetched(txid)
      }
    } else {
      this.txHeights[txid] = {
        firstSeen: Date.now(),
        height
      }
    }
    // Add to the missing headers list:
    if (height > 0 && !this.pluginState.headers[`${height}`]) {
      this.missingHeaders[`${height}`] = true
    }

    this.handleNewTxid(txid)
  }

  // Someone has detected a potentially new txid, so update tables:
  handleNewTxid(txid: string) {
    // Add to the relevant txid list:
    if (typeof this.fetchingTxs[txid] !== 'boolean') {
      this.fetchingTxs[txid] = false
    }

    // Add to the missing tx list:
    if (!this.txs[txid]) {
      this.missingTxs[txid] = true
    }
  }

  // A server has sent UTXO data, so update the caches:
  handleUtxoFetch(
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
    this.addresses[scriptHash].utxos = utxoList
    this.addresses[scriptHash].utxoStratumHash = stateHash
    this.refreshAddressInfo(scriptHash)
  }

  /**
   * If an entry changes in the address cache,
   * update the derived info:
   */
  refreshAddressInfo(scriptHash: string) {
    const address = this.addresses[scriptHash]
    if (!address) return
    const { displayAddress, path, redeemScript } = address

    // It is used if it has transactions or if the metadata says so:
    const used =
      this.usedAddresses[scriptHash] ||
      address.txids.length + address.utxos.length !== 0

    // We only include existing stuff:
    const txids = address.txids.filter(txid => this.txs[txid])
    const utxos = address.utxos.filter(utxo => this.txs[utxo.txid])

    // Make a list of unconfirmed transactions for the utxo search:
    const pendingTxids = txids.filter(
      txid =>
        this.txHeights[txid].height <= 0 &&
        !utxos.find(utxo => utxo.txid === txid)
    )

    // Add all our own unconfirmed outpoints to the utxo list:
    for (const txid of pendingTxids) {
      const tx = this.parsedTxs[txid]
      for (let i = 0; i < tx.outputs.length; ++i) {
        const output = tx.outputs[i]
        if (output.scriptHash === scriptHash) {
          utxos.push({ txid, index: i, value: output.value })
        }
      }
    }

    // Make a table of spent outpoints for filtering the UTXO list:
    const spends = {}
    for (const txid of pendingTxids) {
      const tx = this.parsedTxs[txid]
      for (const input of tx.inputs) {
        spends[`${input.prevout.rhash()}:${input.prevout.index}`] = true
      }
    }

    const utxosWithUnconfirmed = utxos.filter(
      utxo => !spends[`${utxo.txid}:${utxo.index}`]
    )

    const balance = utxosWithUnconfirmed.reduce((s, utxo) => utxo.value + s, 0)

    let prevBalance = 0
    let prevUsed = false
    if (this.addressInfos[scriptHash]) {
      prevBalance = this.addressInfos[scriptHash].balance
      prevUsed = this.addressInfos[scriptHash].used
    }

    // Assemble the info structure:
    this.addressInfos[scriptHash] = {
      txids,
      utxos: utxosWithUnconfirmed,
      used,
      displayAddress,
      path,
      balance,
      redeemScript
    }

    if (prevBalance !== balance) this.onBalanceChanged()
    if (prevUsed !== used) this.onAddressUsed()
  }

  findAffectedAddressesForInputs(txid: string): Array<string> {
    const scriptHashSet = []
    for (const input of this.parsedTxs[txid].inputs) {
      const prevTx = this.parsedTxs[input.prevout.rhash()]
      if (!prevTx) continue
      const prevOut = prevTx.outputs[input.prevout.index]
      if (!prevOut) continue
      scriptHashSet.push(prevOut.scriptHash)
    }
    return scriptHashSet
  }

  findAffectedAddressesForOutput(txid: string): Array<string> {
    const scriptHashSet = []
    for (const output of this.parsedTxs[txid].outputs) {
      if (this.addresses[output.scriptHash]) {
        scriptHashSet.push(output.scriptHash)
      }
    }
    return scriptHashSet
  }

  findAffectedAddresses(txid: string): Array<string> {
    const inputs = this.findAffectedAddressesForInputs(txid)
    const outputs = this.findAffectedAddressesForOutput(txid)
    return inputs.concat(outputs)
  }

  // Finds the txids that a are in a block.
  findAffectedTransactions(height: string): Array<string> {
    const txids = []
    for (const txid in this.txHeights) {
      const tx = this.txHeights[txid]
      if (`${tx.height}` === height) txids.push(txid)
    }
    return txids
  }

  handleMessageError(uri: string, task: string, e: Error) {
    const msg = `connection closed ERROR: ${e.message}`
    console.log(
      `${this.walletId}: ${uri.replace(
        'electrum://',
        ''
      )}: ${msg}: task: ${task}`
    )
    if (this.connections[uri]) {
      this.connections[uri].handleError(e)
    }
  }

  populateServerAddresses(uri: string) {
    const serverState = this.serverStates[uri]
    for (const address of Object.keys(this.addressInfos)) {
      if (!serverState.addresses[address]) {
        serverState.addresses[address] = {
          fetchingTxids: false,
          fetchingUtxos: false,
          hash: null,
          lastUpdate: 0,
          subscribed: false,
          subscribing: false,
          synced: false
        }
      }
    }
  }
}
