// @flow
import type { AbcCurrencyInfo, AbcIo, DiskletFolder } from 'airbitz-core-types'

import type { EngineState } from '../engine/engineState.js'

export interface ServerInfo {
  badMessages: number; // Messages completed with errors
  disconnects: number; // Unwanted socket disconnects
  goodMessages: number; // Messages completed successfully
  latency: number; // Average ms per reply
  version: string; // Server version
}

const TIME_LAZINESS = 10000

/**
 * Returns the average failure rate times the latency.
 * Lower scores are better.
 */
function scoreServer (info: ServerInfo) {
  // We can adjust the weights here,
  // such as making disconnects worth more or less message failures:
  const failures = info.badMessages + 2 * info.disconnects
  const successes = info.goodMessages
  return info.latency * failures / (failures + successes)
}

/**
 * This object holds the plugin-wide per-currency caches.
 * Engine plugins are responsible for keeping it up to date.
 */
export class PluginState {
  // On-disk header information:
  height: number
  headerCache: {
    [height: string]: {
      timestamp: number
    }
  }

  // True if somebody is currently fetching a header:
  headerStates: {
    [height: number]: { fetching: boolean }
  }

  // On-disk server information:
  serverCache: {
    [uri: string]: ServerInfo
  }

  /**
   * Returns an array of Stratum servers, sorted by reliability.
   */
  sortStratumServers (hasTcp: boolean, hasTls: boolean) {
    return Object.keys(this.serverCache)
      .filter(uri => {
        return (
          (hasTcp && /^electrum:/.test(uri)) ||
          (hasTls && /^electrums:/.test(uri))
        )
      })
      .sort((a, b) => {
        const infoA = this.serverCache[a]
        const infoB = this.serverCache[b]
        const blacklistA = infoA.version < '1.0.0'
        const blacklistB = infoB.version < '1.0.0'

        // If one is outdated, it is automatically worse:
        if (blacklistA !== blacklistB) {
          return blacklistA ? 1 : -1
        }
        return scoreServer(infoA) - scoreServer(infoB)
      })
  }

  /**
   * Begins notifying the engine of state changes. Used at connection time.
   */
  addEngine (engineState: EngineState): void {
    this.engines.push(engineState)
  }

  /**
   * Stops notifying the engine of state changes. Used at disconnection time.
   */
  removeEngine (engineState: EngineState): void {
    this.engines = this.engines.filter(engine => engine !== engineState)
  }

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------
  io: AbcIo
  defaultServers: Array<string>
  infoServerUris: string

  engines: Array<EngineState>
  folder: DiskletFolder

  headerCacheDirty: boolean
  headerCacheTimestamp: number
  serverCacheDirty: boolean
  serverCacheTimestamp: number

  constructor (io: AbcIo, currencyInfo: AbcCurrencyInfo) {
    this.height = 0
    this.headerCache = {}
    this.serverCache = {}
    this.io = io
    this.defaultServers = []
    this.infoServerUris = ''
    if (currencyInfo.defaultSettings) {
      this.defaultServers = currencyInfo.defaultSettings.electrumServers || []
      this.infoServerUris = currencyInfo.defaultSettings.infoServer || ''
    }

    this.engines = []
    this.folder = io.folder.folder('plugins').folder(currencyInfo.pluginName)

    this.headerCacheDirty = false
    this.headerCacheTimestamp = Date.now()
    this.serverCacheDirty = false
    this.serverCacheTimestamp = Date.now()
  }

  async load () {
    try {
      const headerCacheText = await this.folder.file('headers.json').getText()
      const headerCacheJson = JSON.parse(headerCacheText)
      // TODO: Validate JSON

      this.headerCacheTimestamp = Date.now()
      this.height = headerCacheJson.height
      this.headerCache = headerCacheJson.headers
    } catch (e) {
      this.headerCache = {}
    }

    try {
      const serverCacheText = await this.folder.file('servers.json').getText()
      const serverCacheJson = JSON.parse(serverCacheText)
      // TODO: Validate JSON

      this.serverCacheTimestamp = Date.now()
      this.serverCache = serverCacheJson.servers
    } catch (e) {
      this.insertServers(this.defaultServers)
    }

    // Fetch stratum servers in the background:
    this.fetchStratumServers().catch(e => this.io.console.error(e))

    return this
  }

  async clearCache () {
    this.headerCache = {}
    this.serverCache = {}
    await this.saveHeaderCache()
    await this.saveServerCache()
  }

  saveHeaderCache () {
    this.io.console.info('Saving header cache')
    return this.folder
      .file('headers.json')
      .setText(
        JSON.stringify({
          height: this.height,
          headers: this.headerCache
        })
      )
      .then(() => {
        this.headerCacheDirty = false
        this.headerCacheTimestamp = Date.now()
      })
  }

  saveServerCache () {
    this.io.console.info('Saving server cache')
    return this.folder
      .file('servers.json')
      .setText(
        JSON.stringify({
          servers: this.serverCache
        })
      )
      .then(() => {
        this.serverCacheDirty = false
        this.serverCacheTimestamp = Date.now()
      })
  }

  dirtyHeaderCache () {
    this.headerCacheDirty = true
    if (this.headerCacheTimestamp + TIME_LAZINESS < Date.now()) {
      this.saveHeaderCache().catch(e => console.error(e))
    }
  }

  dirtyServerCache () {
    this.serverCacheDirty = true
    if (this.serverCacheTimestamp + TIME_LAZINESS < Date.now()) {
      this.saveServerCache().catch(e => console.error(e))
    }
  }

  fetchStratumServers (): Promise<void> {
    const { io } = this
    if (this.infoServerUris === '') return Promise.resolve()
    io.console.info(`GET ${this.infoServerUris}`)
    return io
      .fetch(this.infoServerUris)
      .then(result => {
        if (!result.ok) {
          io.console.error(
            `Fetching ${this.infoServerUris} failed with ${result.status}`
          )
          throw new Error('Cannot fetch stratum server list')
        }
        return result.json()
      })
      .then(json => {
        this.insertServers(json)
      })
  }

  insertServers (serverArray: Array<string>) {
    for (const uri of serverArray) {
      if (!this.serverCache[uri]) {
        this.serverCache[uri] = {
          badMessages: 0,
          disconnects: 0,
          goodMessages: 0,
          latency: 0,
          version: ''
        }
      }
    }
    this.dirtyServerCache()

    // Tell the engines about the new servers:
    for (const engine of this.engines) {
      engine.refillServers()
    }
  }

  serverDisconnected (
    uri: string,
    badMessages: number,
    disconnected: boolean,
    goodMessages: number,
    latency: number
  ) {
    this.serverCache[uri].badMessages += badMessages
    this.serverCache[uri].disconnects += disconnected ? 1 : 0
    this.serverCache[uri].goodMessages += goodMessages
    this.serverCache[uri].latency = latency
    this.dirtyServerCache()
    if (this.headerCacheDirty) {
      this.saveHeaderCache().catch(e => console.error(e))
    }
    if (this.serverCacheDirty) {
      this.saveServerCache().catch(e => console.error(e))
    }
  }

  updateHeight (height: number) {
    if (this.height < height) {
      this.height = height
      this.dirtyHeaderCache()

      // Tell the engines about our new height:
      for (const engine of this.engines) {
        engine.onHeightUpdated(height)
      }
    }
  }
}
