// @flow
import type { EdgeIo, DiskletFolder } from 'edge-core-js'
import type { EngineState } from '../engine/engineState.js'
import { InfoServer } from '../info/constants'
import { ServerCache } from './serverCache.js'
import { saveCache } from '../utils/utils.js'

export type CurrencySettings = {
  customFeeSettings: Array<string>,
  electrumServers: Array<string>,
  disableFetchingServers?: boolean
}

/**
 * This object holds the plugin-wide per-currency caches.
 * Engine plugins are responsible for keeping it up to date.
 */
export type PluginStateSettings = {
  io: EdgeIo,
  defaultSettings: CurrencySettings,
  currencyCode: string,
  pluginName: string
}
export class PluginState extends ServerCache {
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
  serverCache: ServerCache

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

  dumpData (): any {
    return {
      'pluginState.headerCache': this.headerCache,
      'pluginState.serverCache': this.serverCache,
      'pluginState.servers_': this.servers_
    }
  }

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------
  io: EdgeIo
  defaultServers: Array<string>
  infoServerUris: string

  engines: Array<EngineState>
  folder: DiskletFolder

  headerCacheDirty: boolean
  serverCacheJson: Object
  pluginName: string

  constructor ({
    io,
    defaultSettings,
    currencyCode,
    pluginName
  }: PluginStateSettings) {
    super()
    this.height = 0
    this.headerCache = {}
    this.io = io
    this.defaultServers = defaultSettings.electrumServers
    // Rename the bitcoin currencyCode to get the new version of the server list
    const fixedCode = currencyCode === 'BTC' ? 'BC1' : currencyCode
    this.infoServerUris = `${InfoServer}/electrumServers/${fixedCode}`
    this.engines = []
    this.folder = io.folder.folder('plugins').folder(pluginName)
    this.pluginName = pluginName
    this.saveCache = saveCache(this.folder, pluginName)
    this.headerCacheDirty = false
    this.serverCacheJson = {}
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
      const serverCacheText = await this.folder
        .file('serverCache.json')
        .getText()
      const serverCacheJson = JSON.parse(serverCacheText)
      // TODO: Validate JSON

      this.serverCacheJson = serverCacheJson
    } catch (e) {
      console.log(e)
    }

    // Fetch stratum servers in the background:
    this.fetchStratumServers()

    return this
  }

  async clearCache () {
    this.clearServerCache()
    this.headerCache = {}
    this.headerCacheDirty = true
    this.serverCacheDirty = true
    await this.saveHeaderCache()
    await this.saveServerCache()
    await this.fetchStratumServers()
  }

  async saveHeaderCache () {
    this.headerCacheDirty = await this.saveCache('headers.json', this.headerCacheDirty, 'header', {
      height: this.height,
      headers: this.headerCache
    })
  }

  async saveServerCache () {
    this.serverCacheDirty = await this.saveCache('serverCache.json', this.serverCacheDirty, 'server', this.serverCache)
    this.serverCacheLastSave = Date.now()
  }

    }
  }

  dirtyServerCache (serverUrl: string) {
    this.serverCacheDirty = true
    for (const engine of this.engines) {
      if (engine.progressRatio === 1) {
        for (const uri in engine.serverStates) {
          if (uri === serverUrl) {
            this.saveServerCache()
            return
          }
        }
      }
    }
  }

  dirtyHeaderCache () {
    this.headerCacheDirty = true
    for (const engine of this.engines) {
      if (engine.progressRatio === 1) {
        this.saveHeaderCache()
        return
      }
    }
  }

  async fetchStratumServers (): Promise<void> {
    const { io } = this
    console.log(`${this.pluginName} - GET ${this.infoServerUris}`)
    let serverList = this.defaultServers
    try {
      const result = await io.fetch(this.infoServerUris)
      if (!result.ok) {
        console.log(
          `${this.pluginName} - Fetching ${this.infoServerUris} failed with ${
            result.status
          }`
        )
      } else {
        serverList = await result.json()
      }
    } catch (e) {
      console.log(e)
    }
    if (!Array.isArray(serverList)) {
      serverList = this.defaultServers
    }
    this.serverCacheLoad(this.serverCacheJson, serverList)
    await this.saveServerCache()

    // Tell the engines about the new servers:
    for (const engine of this.engines) {
      engine.refillServers()
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
