// @flow
import type { AbcCurrencyInfo, AbcIo, DiskletFolder } from 'airbitz-core-js'

import type { EngineState } from '../engine/engine-state.js'

export interface ServerInfo {
  badMessages: number; // Messages completed with errors
  disconnects: number; // Unwanted socket disconnects
  goodMessages: number; // Messages completed successfully
  latency: number; // Average ms per reply
  version: string; // Server version
}

const infoServerUris = {
  bitcoin: 'https://info1.edgesecure.co:8444/v1/electrumServers/BC1',
  bitcoincash: 'https://info1.edgesecure.co:8444/v1/electrumServers/BCH'
}

const defaultServers = {
  bitcoin: ['electrum://electrum.hsmiths.com:50001'],
  bitcoincash: [],
  bitcointestnet: [],
  dogecoin: [],
  litecoin: []
}

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
  pluginName: string

  engines: Array<EngineState>
  folder: DiskletFolder

  constructor (io: AbcIo, currencyInfo: AbcCurrencyInfo) {
    this.height = 0
    this.headerCache = {}
    this.serverCache = {}
    this.io = io
    this.pluginName = currencyInfo.pluginName
    this.engines = []
    this.folder = io.folder.folder('plugins').folder(this.pluginName)
  }

  async load () {
    try {
      const headerCacheText = await this.folder.file('headers.json').getText()
      const headerCacheJson = JSON.parse(headerCacheText)
      // TODO: Validate JSON

      this.height = headerCacheJson.height
      this.headerCache = headerCacheJson.headers
    } catch (e) {
      this.headerCache = {}
    }

    try {
      const serverCacheText = await this.folder.file('servers.json').getText()
      const serverCacheJson = JSON.parse(serverCacheText)
      // TODO: Validate JSON

      this.serverCache = serverCacheJson.servers
    } catch (e) {
      this.insertServers(defaultServers[this.pluginName])
    }

    return this
  }

  async save () {
    this.folder.file('headers.json').setText(
      JSON.stringify({
        height: this.height,
        headers: this.headerCache
      })
    )
    this.folder.file('servers.json').setText(
      JSON.stringify({
        servers: this.serverCache
      })
    )
  }

  fetchStratumServers () {
    const { io } = this
    const url = infoServerUris[this.pluginName]
    io.console.log(`GET ${url}`)
    io
      .fetch(infoServerUris[this.pluginName])
      .then(result => {
        if (!result.ok) {
          io.console.log(`Fetching ${url} failed with ${result.status}`)
          throw new Error('Cannot fetch stratum server list')
        }
        return result.json()
      })
      .then(json => {
        this.insertServers(json)
      })
      .catch(e => {
        // OK, no servers
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
  }
}
