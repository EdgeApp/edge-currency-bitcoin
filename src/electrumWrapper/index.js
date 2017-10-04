// @flow

const MAX_CONNECTIONS = 4
const MAX_REQUEST_TIME = 1000
const MAX_CONNECTION_HANG_TIME = 2500

// Replacing net module for ReactNative
let getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
let randomHash = () => 'a' + Math.random().toString(36).substring(7)

export class Electrum {
  globalRecievedData: Array<any>
  connected: boolean
  io: any
  connections: Array<any>
  requests: any
  serverList: Array<Array<string>>
  subscribers: {
    address: any,
    numblocks: any
  }
  constructor (serverList: Array<Array<string>>, callbacks: any, io: any) {
    let serverIndex = []
    this.globalRecievedData = []

    // Compiling serverList
    while (serverIndex.length < MAX_CONNECTIONS && serverIndex.length < serverList.length) {
      let j = getRandomInt(0, serverList.length - 1)
      if (serverIndex.indexOf(serverList[j]) === -1) {
        serverIndex.push(serverList[j])
        this.globalRecievedData.push('')
      }
    }
    this.connected = false
    this.io = io
    this.connections = []
    this.requests = {}
    this.serverList = serverIndex
    this.subscribers = {
      address: callbacks.onAddressStatusChanged,
      numblocks: callbacks.onBlockHeightChanged
    }
  }

  compileDataCallback (index: number) {
    let this$1 = this

    return function (data: any) {
      let string = data.toString('utf8')
      this$1.globalRecievedData[index] += string
      let result = []
      if (this$1.globalRecievedData[index].includes('\n')) {
        let mdata = this$1.globalRecievedData[index].split('\n')
        for (var k = 0; k <= mdata.length - 1; k++) {
          if (mdata[k].length) {
            try {
              const res = JSON.parse(mdata[k])
              result.push(res)
            } catch (e) {
              break
            }
          }
        }
        this$1.globalRecievedData[index] = mdata.slice(k, mdata.length).join('')
      } else {
        try {
          const res = JSON.parse(this$1.globalRecievedData[index])
          result.push(res)
          this$1.globalRecievedData[index] = ''
        } catch (e) {}
      }
      result.forEach(r => this$1.handleData(r))
    }
  }

  collectGarbage () {
    this.connections.forEach((connection, index) => {
      if (connection.lastRequest - connection.lastResponse > MAX_CONNECTION_HANG_TIME) {
        let callback = this.compileDataCallback(index)
        return this.netConnect(this.serverList[index][1], this.serverList[index][0], callback, index)
      }
    })
    let now = Date.now()
    for (let i in this.requests) {
      if (now - this.requests[i].requestTime > MAX_REQUEST_TIME && !this.requests[i].executed) {
        this.requests[i].requestTime = now
        let randomIndex = getRandomInt(0, Math.min(MAX_CONNECTIONS, this.connections.length) - 1)
        if (this.socketWriteAbstract(randomIndex, this.requests[i].data) === 2) {
          this.connections[randomIndex].lastRequest = now
        }
      }
    }
  }

  netConnect (port: string, host: string, callback: any, i: number) {
    let resolveProxy

    const out = new Promise((resolve, reject) => {
      resolveProxy = resolve
    })

    let connection = this.io.net.connect(port, host, () => {
      this.connected = true
      connection._state = 2
      resolveProxy(1)
    })
    // serverCache(connection)
    connection._state = 1
    let now = Date.now()

    // Setting up callbacks
    connection.on('data', callback)

    connection.on('close', e => {
      connection._state = 0
      // console.log("[] recieved close", e)
    })

    connection.on('connect', e => {
      // console.log("[] recieved connect", e)
    })

    connection.on('error', e => {
      // console.log("[] recieved error", e)
    })

    connection.on('onerror', e => {
      // console.log("[] recieved close", e)
    })

    connection.on('end', e => {
      connection._state = 0
      // console.log("[] recieved end", e)
    })

    let conn = {
      conn: connection,
      lastRequest: now,
      lastResponse: now,
      prom: out
    }
    if (i === -1) {
      this.connections.push(conn)
    } else {
      this.connections[i] = conn
    }
  }

  connect () {
    this.serverList.forEach((server, index) => {
      let callback = this.compileDataCallback(index)
      this.netConnect(server[1], server[0], callback, -1)
    })
    setInterval(() => {
      this.collectGarbage()
    }, 40000)
  }

  socketWriteAbstract (index: number, data: any) {
    if (this.connections[index].conn._state === 0) {
      var callback = this.compileDataCallback(index)
      this.netConnect(this.serverList[index][1], this.serverList[index][0], callback, index)
      return 0
    }
    if (this.connections[index].conn._state === 1) {
      this.connections[index].prom.then(() => {
        this.connections[index].conn.write(data + '\n')
      })
      return 1
    }
    if (this.connections[index].conn._state === 2) {
      this.connections[index].conn.write(data + '\n')
      return 2
    }
  }

  handleData (data: any) {
    if (data.method) {
      const method = data.method.split('.')
      if (method.length === 3 && method[2] === 'subscribe') {
        this.subscribers[method[1]](...data.params)
        return
      }
    }
    if (typeof this.requests[data.id] !== 'object') return
    if (this.requests[data.id].executed) return
    var now = Date.now()
    this.connections[this.requests[data.id].connectionIndex].lastResponse = now
    this.requests[data.id].executed = 1
    this.requests[data.id].onDataReceived(data.result)
  }

  write (method: string, params: Array<any>) {
    let rejectProxy, resolveProxy
    const hash = randomHash()
    const randomIndex = getRandomInt(0, Math.min(MAX_CONNECTIONS, this.connections.length) - 1)
    let data = JSON.stringify({
      id: hash,
      method: method,
      params: params
    })
    const out = new Promise((resolve, reject) => {
      resolveProxy = resolve
      rejectProxy = resolve
    })

    const now = Date.now()

    this.requests[hash] = {
      data: data,
      executed: 0,
      connectionIndex: randomIndex,
      onDataReceived: resolveProxy,
      onFailure: rejectProxy,
      requestTime: now
    }
    this.connections[randomIndex].lastRequest = now
    this.socketWriteAbstract(randomIndex, data)

    return out
  }

  subscribeToAddress (address: string) {
    return this.write('blockchain.address.subscribe', [address])
  }

  subscribeToBlockHeight () {
    return this.write('blockchain.numblocks.subscribe', [])
  }

  getEstimateFee (blocksToBeIncludedIn: string) {
    return this.write('blockchain.estimatefee', [blocksToBeIncludedIn])
  }

  getAddresHistory (address: string) {
    return this.write('blockchain.address.get_history', [address])
  }

  broadcastTransaction (tx: string) {
    return this.write('blockchain.transaction.broadcast', [tx])
  }

  getBlockHeader (height: number) {
    return this.write('blockchain.block.get_header', [height])
  }

  getTransaction (transactionID: string) {
    return this.write('blockchain.transaction.get', [transactionID])
  }
}
