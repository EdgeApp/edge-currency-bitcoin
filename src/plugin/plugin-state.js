// @flow
import type { AbcCurrencyInfo, AbcIo, DiskletFolder } from 'airbitz-core-js'

import type { EngineState } from '../engine/engine-state.js'

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
    [uri: string]: {
      score: number,
      latency: number // ms
    }
  }

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------
  io: AbcIo
  engines: Array<EngineState>
  folder: DiskletFolder

  constructor (io: AbcIo, currencyInfo: AbcCurrencyInfo) {
    this.height = 0
    this.headerCache = {}
    this.serverCache = {}
    this.io = io
    this.engines = []
    this.folder = io.folder.folder('plugins').folder(currencyInfo.pluginName)
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
      // TODO: No server cache. Fetch from the info server.
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

  addEngine (engineState: EngineState): void {
    this.engines.push(engineState)
  }

  removeEngine (engineState: EngineState): void {
    this.engines = this.engines.filter(engine => engine !== engineState)
  }
}
