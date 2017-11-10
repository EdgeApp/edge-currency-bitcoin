/**
 * Created by Paul Puey on 2017/11/09
 * @flow
 */

type ServerInfo = {
  serverUrl: string,
  serverScore: number,
  responseTime: number,
  numResponseTimes: number
}

const RESPONSE_TIME_UNINITIALIZED = 999999999
const MAX_SCORE = 500
// const MIN_SCORE = -100

export class ServerCache {
  servers_: {[serverUrl: string]: ServerInfo}
  dirty_: boolean
  cacheLastSave_: number

  constructor () {
    this.servers_ = {}
    this.dirty_ = false
    this.cacheLastSave_ = 0
  }

  /**
   * Loads the server cache with new and old servers
   * @param oldServers: Map of ServerInfo objects by serverUrl. This should come from disk
   * @param newServers: Array<string> of new servers downloaded from the info server
   */
  serverCacheLoad (oldServers: {[serverUrl: string]: ServerInfo}, newServers: Array<string> = []) {
    //
    // Add any new servers coming out of the info server
    //
    for (const newServer of newServers) {
      if (oldServers[newServer] === undefined) {
        const serverScoreObj: ServerInfo = {
          serverUrl: newServer,
          serverScore: 0,
          responseTime: RESPONSE_TIME_UNINITIALIZED,
          numResponseTimes: 0
        }
        oldServers[newServer] = serverScoreObj
      }
    }

    //
    // If there is a cached server (oldServers) that is not on the newServers array, then set it's score to -1
    // to reduce chances of using it.
    //
    for (const serverUrl in oldServers) {
      const oldServer = oldServers[serverUrl]
      let match = false
      for (const newServerUrl of newServers) {
        if (newServerUrl === serverUrl) {
          match = true
          break
        }
      }

      let serverScore = oldServer.serverScore
      if (!match) {
        if (serverScore >= 0) {
          serverScore = -1
        }
      }

      if (this.cacheLastSave_ === 0) {
        serverScore = serverScore > MAX_SCORE - 100 ? MAX_SCORE - 100 : serverScore
      }

      oldServer.serverScore = serverScore
      this.servers_[serverUrl] = oldServer
    }
  }

  serverCacheSave () {

  }

  serverScoreUp (serverUrl: string, changeScore: number = 1) {

  }

  serverScoreDown (serverUrl: string, changeScore: number = 10) {

  }

  setResponseTime (serverUrl: string, responseTimeMilliseconds: number) {

  }

  getServers (numServers: number) {
    const serverInfos: Array<ServerInfo> = []
    const newServerInfos: Array<ServerInfo> = []
    //
    // Find new servers and cache them away
    //
    for (const s in this.servers_) {
      const server = this.servers_[s]
      serverInfos.push(server)
      if (
        server.responseTime === RESPONSE_TIME_UNINITIALIZED &&
        server.serverScore === 0
      ) {
        newServerInfos.push(server)
      }
    }
    if (serverInfos.length === 0) {
      return []
    }

    // Sort by score
    serverInfos.sort((a, b) => {
      if (a.serverScore < b.serverScore) {
        return -1
      } else if (a.serverScore > b.serverScore) {
        return 1
      } else {
        return 0
      }
    })

    //
    // Take the top 50% of servers that have
    // 1. A score between 100 points of the highest score
    // 2. A positive score of at least 5
    // 3. A response time that is not RESPONSE_TIME_UNINITIALIZED
    //
    // Then sort those top servers by response time from lowest to highest
    //
  }
}
