// @flow
import type { AbcCurrencyInfo, AbcIo, DiskletFolder } from 'edge-login'
import type { EngineState } from '../engine/engineState.js'
import { ServerCache } from './serverCache.js'

export const TIME_LAZINESS = 10000

/**
 * This object holds the plugin-wide per-currency caches.
 * Engine plugins are responsible for keeping it up to date.
 */
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
  serverCacheJson: Object
  pluginName: string

  constructor (io: AbcIo, currencyInfo: AbcCurrencyInfo) {
    super()
    this.height = 0
    this.headerCache = {}
    this.io = io
    this.defaultServers = []
    this.infoServerUris = ''
    if (currencyInfo.defaultSettings) {
      const { electrumServers, infoServer } = currencyInfo.defaultSettings
      let { currencyCode } = currencyInfo
      // Rename the bitcoin currencyCode to get the new version of the server list
      if (currencyCode === 'BTC') {
        currencyCode = 'BC1'
      }
      this.defaultServers = electrumServers || []
      this.infoServerUris = infoServer ? `${infoServer}/electrumServers/${currencyCode}` : ''
    }
    this.engines = []
    this.folder = io.folder.folder('plugins').folder(currencyInfo.pluginName)
    this.pluginName = currencyInfo.pluginName
    this.headerCacheDirty = false
    this.headerCacheTimestamp = Date.now()
    this.serverCacheJson = {}
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
    await this.serverCacheSave()
    await this.fetchStratumServers()
  }

  saveHeaderCache (): Promise<void> {
    if (this.headerCacheDirty) {
      return this.folder
        .file('headers.json')
        .setText(
          JSON.stringify({
            height: this.height,
            headers: this.headerCache
          })
        )
        .then(() => {
          console.log(`${this.pluginName} - Saved header cache`)
          this.headerCacheDirty = false
          this.headerCacheTimestamp = Date.now()
        })
        .catch(e => console.log(`${this.pluginName} - ${e.toString()}`))
    }
    return Promise.resolve()
  }

  async saveData (data: Object) {
    try {
      await this.folder.file('serverCache.json').setText(JSON.stringify(data))
      console.log(`${this.pluginName} - Saved server cache`)
    } catch (e) {
      console.log(`${this.pluginName} - ${e.toString()}`)
    }
  }

  dirtyHeaderCache () {
    this.headerCacheDirty = true
    if (this.headerCacheTimestamp + TIME_LAZINESS < Date.now()) {
      this.saveHeaderCache()
    }
  }

  async fetchStratumServers (): Promise<void> {
    const { io } = this
    console.log(`${this.pluginName} - GET ${this.infoServerUris}`)
    let serverList = this.defaultServers
    try {
      if (this.infoServerUris !== '') {
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
      }
    } catch (e) {
      console.log(e)
    }
    this.serverCacheLoad(this.serverCacheJson, serverList)
    await this.serverCacheSave()

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
