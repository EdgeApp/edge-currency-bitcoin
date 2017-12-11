// @flow
import type { AbcCurrencyInfo, AbcIo, DiskletFolder } from 'airbitz-core-types'

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
  bitcoincash: 'https://info1.edgesecure.co:8444/v1/electrumServers/BCH',
  bitcointestnet: '',
  dogecoin: '',
  litecoin: 'https://info1.edgesecure.co:8444/v1/electrumServers/LTC'
}

const defaultServers = {
  bitcoin: [
    'electrums://electrum-bc-az-eusa.airbitz.co:50002',
    'electrum://electrum-bc-az-eusa.airbitz.co:50001',
    'electrum://electrum.hsmiths.com:8080',
    'electrums://E-X.not.fyi:50002',
    'electrums://node.arihanc.com:50002',
    'electrum://node.arihanc.com:50001',
    'electrums://electrum.petrkr.net:50002',
    'electrum://electrum.petrkr.net:50001',
    'electrums://electrum2.everynothing.net:50002',
    'electrum://electrum2.everynothing.net:50001',
    'electrums://lith.strangled.net:50002',
    'electrums://s4.noip.pl:50104',
    'electrum://currentlane.lovebitco.in:50001',
    'electrums://electrum.hsmiths.com:50002',
    'electrum://electrum.hsmiths.com:50001',
    'electrums://electrumx.westeurope.cloudapp.azure.com:50002',
    'electrum://electrumx.westeurope.cloudapp.azure.com:50001'
  ],
  bitcoincash: [
    'electrum://abc1.hsmiths.com:60001',
    'electrums://electroncash.bitcoinplug.com:50002',
    'electrum://electroncash.bitcoinplug.com:50001',
    'electrums://bch.tedy.pw:50002',
    'electrum://bch.tedy.pw:50001',
    'electrums://electroncash.cascharia.com:50002',
    'electrums://14.3.38.179:50002',
    'electrum://14.3.38.179:50001',
    'electrums://bch.arihanc.com:52002',
    'electrum://bch.arihanc.com:52001',
    'electrums://electron-cash.dragon.zone:50002',
    'electrum://electron-cash.dragon.zone:50001',
    'electrum://bch.stitthappens.com:50001',
    'electrum://abc.vom-stausee.de:52001',
    'electrums://electron.coinucopia.io:50002',
    'electrum://electron.coinucopia.io:50001',
    'electrums://elecash.bcc.nummi.it:50012',
    'electrum://electron.jns.im:50001',
    'electrums://electrum.leblancnet.us:50012',
    'electrum://electrum.leblancnet.us:50011',
    'electrums://bch.curalle.ovh:50002',
    'electrums://electron.jns.im:50002',
    'electrums://abc.vom-stausee.de:52002',
    'electrums://abc1.hsmiths.com:60002',
    'electrum://electrumx-cash.itmettke.de:50001',
    'electrums://electrumx-cash.itmettke.de:50002',
    'electrums://electrumx-bch.adminsehow.com:50012',
    'electrum://electrumx-bch.adminsehow.com:50011'
  ],
  bitcointestnet: ['electrum://testnetnode.arihanc.com:51001'],
  dash: [
    'electrum://electrum.dash.siampm.com:50001',
    'electrum://e-1.claudioboxx.com:50005',
    'electrum://electrum.leblancnet.us:50015',
    'electrums://e-1.claudioboxx.com:50006',
    'electrums://ele.nummi.it:50008',
    'electrums://178.62.234.69:50002',
    'electrum://178.62.234.69:50001',
    'electrums://electrum.leblancnet.us:50016',
    'electrums://electrum.dash.siampm.com:50002'
  ],
  dogecoin: [],
  litecoin: [
    'electrum://electrum-ltc.festivaldelhumor.org:60001',
    'electrum://electrum-ltc.petrkr.net:60001',
    'electrum://electrumx.nmdps.net:9433',
    'electrums://electrum-ltc.festivaldelhumor.org:60002',
    'electrums://electrum-ltc.petrkr.net:60002',
    'electrums://electrum-ltc.villocq.com:60002',
    'electrum://electrum-ltc.villocq.com:60001',
    'electrums://elec.luggs.co:444',
    'electrums://ltc01.knas.systems:50004',
    'electrum://ltc01.knas.systems:50003',
    'electrums://electrum-ltc.wilv.in:50002',
    'electrum://electrum-ltc.wilv.in:50001',
    'electrums://electrum.ltc.xurious.com:50002',
    'electrum://electrum.ltc.xurious.com:50001',
    'electrums://lith.strangled.net:50003',
    'electrums://electrum.leblancnet.us:50004',
    'electrum://electrum.leblancnet.us:50003',
    'electrums://electrum-ltc0.snel.it:50004',
    'electrum://electrum-ltc0.snel.it:50003',
    'electrums://e-2.claudioboxx.com:50004',
    'electrum://e-2.claudioboxx.com:50003',
    'electrums://e-1.claudioboxx.com:50004',
    'electrum://e-1.claudioboxx.com:50003',
    'electrum://node.ispol.sk:50003',
    'electrums://electrum-ltc.bysh.me:50002',
    'electrum://electrum-ltc.bysh.me:50001',
    'electrums://e-3.claudioboxx.com:50004',
    'electrum://e-3.claudioboxx.com:50003',
    'electrums://node.ispol.sk:50004',
    'electrums://electrumx.nmdps.net:9434'
  ]
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
          io.console.error(`Fetching ${this.infoServerUris} failed with ${result.status}`)
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
