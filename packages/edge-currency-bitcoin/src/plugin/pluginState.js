// @flow

import type { Disklet } from 'disklet'
import { navigateDisklet } from 'disklet'
import type { EdgeIo } from 'edge-core-js/types'

import type { PluginStateSettings } from '../../types/plugin.js'
import type { EngineState } from '../engine/engineState.js'
import { FixCurrencyCode, InfoServer } from '../info/constants'
import { cache } from '../utils/utils.js'
import { ServerCache } from './serverCache.js'

export class PluginState extends ServerCache {
  // On-disk header information:
  height: { latest: number }
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
      'pluginState.serverCache': this.serverCache
    }
  }

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------
  io: EdgeIo
  disableFetchingServers: boolean
  defaultServers: Array<string>
  infoServerUris: string

  engines: Array<EngineState>
  disklet: Disklet

  headerCacheDirty: boolean
  serverCacheJson: Object
  pluginName: string
  headersFile: string
  serverCacheFile: string
  heightFile: string

  constructor ({
    io,
    files,
    defaultSettings,
    currencyCode,
    pluginName
  }: PluginStateSettings) {
    super()
    this.io = io
    this.headersFile = files.headers
    this.serverCacheFile = files.serverCache
    this.heightFile = files.height

    this.defaultServers = defaultSettings.electrumServers
    this.disableFetchingServers = !!defaultSettings.disableFetchingServers
    // Rename the bitcoin currencyCode to get the new version of the server list
    const fixedCode = FixCurrencyCode(currencyCode)
    this.infoServerUris = `${InfoServer}/electrumServers/${fixedCode}`
    this.engines = []
    this.disklet = navigateDisklet(io.disklet, 'plugins/' + pluginName)
    this.pluginName = pluginName
  }

  async load () {
    this.headerCache = await cache(
      this.disklet,
      this.headersFile,
      this.pluginName
    )
    this.height = await cache(this.disklet, this.heightFile, this.pluginName)
    if (!this.height.latest) this.height.latest = 0
    this.serverCacheJson = await cache(
      this.disklet,
      this.serverCacheFile,
      this.pluginName
    )

    // Fetch stratum servers in the background:
    this.fetchStratumServers()

    return this
  }

  async clearCache () {
    // $FlowFixMe
    this.headerCache({})
    // $FlowFixMe
    this.height({})
    this.serverCacheJson({})

    this.clearServerCache()
    await this.fetchStratumServers()
  }

  async fetchStratumServers (): Promise<void> {
    const { io } = this
    let serverList = this.defaultServers
    if (!this.disableFetchingServers) {
      try {
        console.log(`${this.pluginName} - GET ${this.infoServerUris}`)
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
    }
    if (!Array.isArray(serverList)) {
      serverList = this.defaultServers
    }
    this.addServers(this.serverCacheJson, serverList)

    // Tell the engines about the new servers:
    for (const engine of this.engines) {
      engine.refillServers()
    }
  }

  updateHeight (height: number) {
    if (this.height.latest < height) {
      this.height.latest = height

      // Tell the engines about our new height:
      for (const engine of this.engines) {
        engine.onHeightUpdated(height)
      }
    }
  }

  async updateServers (settings: Object) {
    const { electrumServers, disableFetchingServers } = settings || {}
    if (typeof disableFetchingServers === 'boolean') {
      this.disableFetchingServers = disableFetchingServers
    }
    if (Array.isArray(electrumServers)) {
      this.defaultServers = electrumServers
    }
    const engines = []
    const disconnects = []
    for (const engine of this.engines) {
      engines.push(engine)
      engine.serverList = []
      disconnects.push(engine.disconnect())
    }
    await Promise.all(disconnects)
    // this.clearServerCache()
    // this.serverCacheJson = {}
    await this.fetchStratumServers()
    for (const engine of engines) {
      engine.connect()
    }
  }
}
