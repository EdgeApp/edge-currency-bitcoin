// @flow

import { type Disklet, navigateDisklet } from 'disklet'
import { type EdgeIo } from 'edge-core-js/types'

import { type PluginStateSettings } from '../../types/plugin.js'
import { type EngineState } from '../engine/engineState.js'
import { cache } from '../utils/utils.js'
import { ServerCache } from './serverCache.js'
import { logger } from '../utils/logger.js'
export class PluginState extends ServerCache {
  // On-disk header information:
  height: { latest: number }
  headers: {
    [height: string]: {
      timestamp: number
    }
  }

  // True if somebody is currently fetching a header:
  headerStates: {
    [height: number]: { fetching: boolean }
  }

  // On-disk server information:
  servers: ServerCache

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

  disconnect () {
    return Promise.all([
      // $FlowFixMe
      this.headers('stop'),
      // $FlowFixMe
      this.height('stop'),
      // $FlowFixMe
      this.servers('stop')
    ])
  }

  dumpData (): any {
    return {
      'pluginState.headers': this.headers,
      'pluginState.servers': this.servers
    }
  }

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------
  io: EdgeIo
  disableFetchingServers: boolean
  defaultServers: Array<string>
  electrumServersUrl: string

  engines: Array<EngineState>
  disklet: Disklet

  headersDirty: boolean
  pluginName: string
  headersFile: string
  serversFile: string
  heightFile: string

  constructor ({
    io,
    electrumServersUrl,
    defaultSettings,
    currencyCode,
    pluginName
  }: PluginStateSettings) {
    super()
    this.io = io

    this.defaultServers = defaultSettings.electrumServers
    this.disableFetchingServers = !!defaultSettings.disableFetchingServers
    // Rename the bitcoin currencyCode to get the new version of the server list
    this.electrumServersUrl = electrumServersUrl

    this.engines = []
    this.disklet = navigateDisklet(io.disklet, 'plugins/' + pluginName)
    this.pluginName = pluginName
  }

  async load () {
    const { headers, height, servers } = await cache(
      this.disklet,
      ['headers', 'servers', 'height'],
      this.pluginName
    )

    this.headers = headers
    this.height = height
    this.servers = servers

    if (!this.height.latest) this.height.latest = 0

    // Fetch stratum servers in the background:
    this.fetchStratumServers()

    return this
  }

  async clearCache () {
    // $FlowFixMe
    await this.headers({})
    // $FlowFixMe
    await this.height({})
    this.clearServerCache()
    // $FlowFixMe
    await this.servers({})
    await this.fetchStratumServers()
  }

  async fetchStratumServers (): Promise<void> {
    const { io } = this
    let serverList = this.defaultServers
    if (!this.disableFetchingServers) {
      try {
        logger.info(`${this.pluginName} - GET ${this.electrumServersUrl}`)
        const result = await io.fetch(this.electrumServersUrl)
        if (!result.ok) {
          logger.info(
            `${this.pluginName} - Fetching ${
              this.electrumServersUrl
            } failed with ${result.status}`
          )
        } else {
          serverList = await result.json()
        }
      } catch (e) {
        logger.info(e)
      }
    }
    if (!Array.isArray(serverList)) {
      serverList = this.defaultServers
    }
    this.addServers(this.servers, serverList)

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
    this.clearServerCache()
    // $FlowFixMe
    await this.servers({})
    await this.fetchStratumServers()
    for (const engine of engines) {
      engine.connect()
    }
  }
}
