/**
 * Created by Paul Puey on 2017/11/09
 * @flow
 */

export type ServerInfo = {
  serverUrl: string,
  serverScore: number,
  responseTime: number,
  numResponseTimes: number
}

const RESPONSE_TIME_UNINITIALIZED = 999999999
const MAX_SCORE = 500
const MIN_SCORE = -100
const SAVE_LAZINESS = 10000

export class ServerCache {
  servers_: { [serverUrl: string]: ServerInfo }
  dirty_: boolean
  cacheLastSave_: number
  lastScoreUpTime_: number
  lastSaveTime: number

  constructor () {
    this.clearServerCache()
  }

  /**
   * Loads the server cache with new and old servers
   * @param oldServers: Map of ServerInfo objects by serverUrl. This should come from disk
   * @param newServers: Array<string> of new servers downloaded from the info server
   */
  serverCacheLoad (
    oldServers: { [serverUrl: string]: ServerInfo },
    newServers: Array<string> = []
  ) {
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
        serverScore =
          serverScore > MAX_SCORE - 100 ? MAX_SCORE - 100 : serverScore
      }

      oldServer.serverScore = serverScore
      this.servers_[serverUrl] = oldServer
    }
    this.dirty_ = true
  }

  async saveData (data: Object) {}

  async serverCacheSave () {
    this.printServerCache()
    if (this.dirty_ && this.lastSaveTime + SAVE_LAZINESS < Date.now()) {
      await this.saveData(this.servers_)
      this.dirty_ = false
      this.lastSaveTime = Date.now()
    }
  }

  clearServerCache () {
    this.servers_ = {}
    this.dirty_ = false
    this.cacheLastSave_ = 0
    this.lastScoreUpTime_ = Date.now()
    this.lastSaveTime = 0
  }

  printServerCache () {
    console.log('**** printServerCache ****')
    const serverInfos: Array<ServerInfo> = []
    for (const s in this.servers_) {
      serverInfos.push(this.servers_[s])
    }
    // Sort by score
    serverInfos.sort((a: ServerInfo, b: ServerInfo) => {
      return b.serverScore - a.serverScore
    })

    for (const s of serverInfos) {
      const score = s.serverScore.toString()
      const response = s.responseTime.toString()
      const numResponse = s.numResponseTimes.toString()
      const url = s.serverUrl
      console.log(`ServerCache ${score} ${response}ms ${numResponse} ${url}`)
    }
    console.log('**************************')
  }

  serverScoreUp (serverUrl: string, responseTimeMilliseconds: number, changeScore: number = 1) {
    const serverInfo: ServerInfo = this.servers_[serverUrl]

    serverInfo.serverScore += changeScore
    if (serverInfo.serverScore > MAX_SCORE) {
      serverInfo.serverScore = MAX_SCORE
      this.dirty_ = true
    }

    console.log(`ServerCache UP: ${serverUrl} ${serverInfo.serverScore} ${responseTimeMilliseconds}`)
    this.lastScoreUpTime_ = Date.now()

    if (responseTimeMilliseconds !== 0) {
      this.setResponseTime(serverUrl, responseTimeMilliseconds)
    }
  }

  serverScoreDown (serverUrl: string, changeScore: number = 10) {
    const currentTime = Date.now()
    if (currentTime - this.lastScoreUpTime_ > 60000) {
      // It has been over 1 minute since we got an upvote for any server.
      // Assume the network is down and don't penalize anyone for now
      return
    }
    const serverInfo: ServerInfo = this.servers_[serverUrl]
    serverInfo.serverScore -= changeScore
    if (serverInfo.serverScore < MIN_SCORE) {
      serverInfo.serverScore = MIN_SCORE
      this.dirty_ = true
    }
    console.log(`ServerCache DOWN: ${serverUrl} ${serverInfo.serverScore.toString()}`)
  }

  setResponseTime (serverUrl: string, responseTimeMilliseconds: number) {
    const serverInfo: ServerInfo = this.servers_[serverUrl]
    serverInfo.numResponseTimes++

    const oldtime = serverInfo.responseTime
    let newTime = 0
    if (RESPONSE_TIME_UNINITIALIZED === oldtime) {
      newTime = responseTimeMilliseconds
    } else {
      // Every 10th setting of response time, decrease effect of prior values by 5x
      if (serverInfo.numResponseTimes % 10 === 0) {
        newTime = (oldtime + responseTimeMilliseconds * 4) / 5
      } else {
        newTime = (oldtime + responseTimeMilliseconds) / 2
      }
    }
    serverInfo.responseTime = newTime
    this.dirty_ = true
  }

  getServers (numServersWanted: number): Array<string> {
    if (!this.servers_ || this.servers_.length === 0) {
      return []
    }

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
    serverInfos.sort((a: ServerInfo, b: ServerInfo) => {
      return b.serverScore - a.serverScore
    })

    //
    // Take the top 50% of servers that have
    // 1. A score between 100 points of the highest score
    // 2. A positive score of at least 5
    // 3. A response time that is not RESPONSE_TIME_UNINITIALIZED
    //
    // Then sort those top servers by response time from lowest to highest
    //

    const startServerInfo = serverInfos[0]
    let numServerPass = 0
    let serverEnd = 0
    for (let i = 0; i < serverInfos.length; i++) {
      const serverInfo = serverInfos[i]
      if (serverInfo.serverScore < startServerInfo.serverScore - 100) {
        continue
      }
      if (serverInfo.serverScore < 5) {
        continue
      }
      if (serverInfo.responseTime >= RESPONSE_TIME_UNINITIALIZED) {
        continue
      }
      numServerPass++
      if (numServerPass < numServersWanted) {
        continue
      }
      if (numServerPass >= serverInfos.length / 2) {
        continue
      }
      serverEnd = i
    }

    let topServerInfos = serverInfos.slice(0, serverEnd)
    topServerInfos.sort((a: ServerInfo, b: ServerInfo) => {
      return a.responseTime - b.responseTime
    })
    topServerInfos = topServerInfos.concat(serverInfos.slice(serverEnd))

    const servers = []
    let numServers = 0
    let numNewServers = 0
    for (const serverInfo of topServerInfos) {
      numServers++
      servers.push(serverInfo.serverUrl)
      if (
        serverInfo.responseTime === RESPONSE_TIME_UNINITIALIZED &&
        serverInfo.serverScore === 0
      ) {
        numNewServers++
      }

      if (numServers >= numServersWanted) {
        break
      }

      if (numServers >= numServersWanted / 2 && numNewServers === 0) {
        if (newServerInfos.length >= numServersWanted - numServers) {
          break
        }
      }
    }

    // If this list does not have a new server in it, try to add one as we always want to give new
    // servers a try.
    if (numNewServers === 0) {
      for (const serverInfo of newServerInfos) {
        servers.unshift(serverInfo.serverUrl)
        numServers++
        if (numServers >= numServersWanted) {
          break
        }
      }
    }

    return servers
  }
}
