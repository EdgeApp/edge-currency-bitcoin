// @flow
import type { AbcCurrencyInfo, AbcIo, DiskletFolder } from 'edge-login'
import type { EngineState } from '../engine/engineState.js'
import { ServerCache } from '../engine/serverCache.js'

export const TIME_LAZINESS = 10000

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
    this.height = 0
    this.headerCache = {}
    this.serverCache = new ServerCache(this.saveData.bind(this))
    this.io = io
    this.defaultServers = []
    this.infoServerUris = ''
    if (currencyInfo.defaultSettings) {
      this.defaultServers = currencyInfo.defaultSettings.electrumServers || []
      this.infoServerUris = currencyInfo.defaultSettings.infoServer || ''
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
      const serverCacheText = await this.folder.file('serverCache.json').getText()
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
    this.headerCache = {}
    this.serverCache = new ServerCache(this.saveData.bind(this))
    this.headerCacheDirty = true
    await this.saveHeaderCache()
    await this.serverCache.serverCacheSave()
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
          this.log('Saved header cache')
          this.headerCacheDirty = false
          this.headerCacheTimestamp = Date.now()
        })
        .catch(e => this.log(e))
    }
    return Promise.resolve()
  }

  async saveData (data: Object) {
    try {
      await this.folder.file('serverCache.json').setText(JSON.stringify(data))
      this.log('Saved server cache')
    } catch (e) {
      this.log(e)
    }
  }

  // saveServerCache (): Promise<void> {
  //   if (this.serverCacheDirty) {
  //     const servers = this.serverCache.serverCacheSave()
  //     return this.folder
  //       .file('serverCache.json')
  //       .setText(
  //         JSON.stringify(servers)
  //       )
  //       .then(() => {
  //         this.log('Saved server cache')
  //         this.serverCacheDirty = false
  //         this.serverCacheTimestamp = Date.now()
  //       })
  //       .catch(e => this.log(e))
  //   }
  //   return Promise.resolve()
  // }

  dirtyHeaderCache () {
    this.headerCacheDirty = true
    if (this.headerCacheTimestamp + TIME_LAZINESS < Date.now()) {
      this.saveHeaderCache()
    }
  }

  // dirtyServerCache () {
  //   this.serverCacheDirty = true
  //   if (this.serverCacheTimestamp + TIME_LAZINESS < Date.now()) {
  //     this.saveServerCache()
  //   }
  // }

  async fetchStratumServers (): Promise<void> {
    const { io } = this
    this.log(`GET ${this.infoServerUris}`)
    let serverList = this.defaultServers
    try {
      if (this.infoServerUris !== '') {
        const result = await io.fetch(this.infoServerUris)
        if (!result.ok) {
          this.log(
            `Fetching ${this.infoServerUris} failed with ${result.status}`
          )
        } else {
          serverList = await result.json()
        }
      }
    } catch (e) {
      console.log(e)
    }
    this.serverCache.serverCacheLoad(this.serverCacheJson, serverList)
    await this.serverCache.serverCacheSave()

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

  log (...text: Array<any>) {
    text[0] = `${this.pluginName} - ${text[0]}`
    console.log(...text)
  }
}
