const MAX_CONNECTIONS = 4
const MAX_REQUEST_TIME = 1000
const MAX_CONNECTION_HANG_TIME = 2500

// Replacing net module for ReactNative
let getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
let randomHash = () => 'a' + Math.random().toString(36).substring(7)

export class Electrum {
  constructor (serverList, callbacks, io) {
    let serverIndex = []
    this.globalRecievedData = []

    // Compiling serverList
    while (serverIndex.length < MAX_CONNECTIONS && serverIndex.length < serverList.length) {
      let j = getRandomInt(0, serverList.length - 1)
      if (serverIndex.indexOf(j) === -1) {
        serverIndex.push(serverList[j])
        this.globalRecievedData.push('')
      }
    }
    this.connected = false
    this.io = io
    this.connections = []
    this.requests = {}
    this.cache = {}
    this.serverList = serverIndex
    this.onAddressStatusChanged = callbacks.onAddressStatusChanged
    this.onBlockHeightChanged = callbacks.onBlockHeightChanged
  }
  compileDataCallback (index) {
    var this$1 = this

    return function (data) {
      var string = ''
      for (var ui = 0; ui <= data.length - 1; ui++) {
        string += String.fromCharCode(data[ui])
      }
      this$1.globalRecievedData[index] += string
      var result = []
      if (this$1.globalRecievedData[index].indexOf('\n') > -1) {
        // // console.log("stringbeforesplit ",this$1.globalRecievedData[index])
        var mdata = this$1.globalRecievedData[index].split('\n')
        for (var k = 0; k <= mdata.length - 1; k++) {
          if (mdata[k].length < 3) {
            continue
          }
          // // console.log("ssbefore parsing, mk ",mdata[k])
          var res = false
          try {
            res = JSON.parse(mdata[k])
            result.push(res)
          } catch (e) {}
        }
      } else {
        // // console.log("ssbefore parsing, s ",this$1.globalRecievedData[index])
        try {
          data = JSON.parse(this$1.globalRecievedData[index])
          result.push(data)
        } catch (e) {
          // console.log("parse error", e)
        }
      }
      if (result.length > 0) {
        this$1.globalRecievedData[index] = ''
      }
      for (var o = 0; o <= result.length - 1; o++) {
        this$1.handleData(result[o])
      }
    }
  }

  updateCache (data) {
    this.cache = {}
    for (var i in data) {
      for (var j in data[i].txs) {
        this.cache[j] = data[i].txs[j]
      }
    }
  }

  collectGarbage () {
    // console.log("collectGarbage > ")
    for (let j in this.connections) {
      // // console.log("RECONNECT CHECK", j, this.connections[j].lastResponse, this.connections[j].lastRequest)
      if (this.connections[j].lastRequest - this.connections[j].lastResponse > MAX_CONNECTION_HANG_TIME) {
        let callback = this.compileDataCallback(j)
          // console.log("RECONNECTING TO SERVER", this.serverList[j][1], this.serverList[j][0], j)
        return this.netConnect(this.serverList[j][1], this.serverList[j][0], callback, j)
      }
    }
    let now = Date.now()
    for (let i in this.requests) {
      // console.log(now, this.requests[i], MAX_REQUEST_TIME)
      if (now - this.requests[i].requestTime > MAX_REQUEST_TIME && !this.requests[i].executed) {
        this.requests[i].requestTime = now
        let randomIndex = getRandomInt(0, Math.min(MAX_CONNECTIONS, this.connections.length) - 1)
          // console.log("RE-REQUESTING", this.connections[randomIndex], this.requests[i].data)

        if (this.socketWriteAbstract(randomIndex, this.requests[i].data) === 2) {
          this.connections[randomIndex].lastRequest = now
        }
      }
    }
  }

  netConnect (port, host, callback, i) {
    let resolveProxy

    const out = new Promise((resolve, reject) => {
      resolveProxy = resolve
    })

    let connection = this.io.net.connect(port, host, () => {
      this.connected = true
      connection._state = 2
      resolveProxy(1)
    })
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
    for (var i in this.serverList) {
      // compilig callback with right index
      let callback = this.compileDataCallback(i)
      this.netConnect(this.serverList[i][1], this.serverList[i][0], callback, -1)
    }

    setInterval(() => {
      this.collectGarbage()
    }, 400)
  }

  socketWriteAbstract (index, data) {
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

  write (data) {
    let rejectProxy, resolveProxy
    const hash = randomHash()
    const randomIndex = getRandomInt(0, Math.min(MAX_CONNECTIONS, this.connections.length) - 1)
    data = data.replace('[ID]', hash)

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

  subscribeToAddress (address) {
    return this.write(`{ "id": "[ID]", "method":"blockchain.address.subscribe", "params": ["${address}"] }`)
  }

  subscribeToBlockHeight () {
    return this.write('{ "id": "[ID]", "method": "blockchain.numblocks.subscribe", "params": [] }')
  }

  getEstimateFee (blocksToBeIncludedIn) {
    return this.write(`{ "id": "[ID]", "method": "blockchain.estimatefee", "params": [${blocksToBeIncludedIn}] }`)
  }

  getAddresHistory (address) {
    return this.write('{ "id": "[ID]", "method":"blockchain.address.get_history", "params":["' + address + '"] }')
  }

  broadcastTransaction (tx) {
    return this.write(`{ "id": "[ID]", "method":"blockchain.transaction.broadcast", "params":["${tx}"] }`)
  }

  handleData (data) {
    // console.log(data)
    if (data.method === 'blockchain.address.subscribe' && data.params.length === 2) {
      this.onAddressStatusChanged(data.params[0], data.params[1])
      return
    }
    if (data.method === 'blockchain.numblocks.subscribe' && data.params.length === 1) {
      this.onBlockHeightChanged(data.params[0])
      return
    }
    if (typeof this.requests[data.id] !== 'object') return
    if (this.requests[data.id].executed) return
    var now = Date.now()
    this.connections[this.requests[data.id].connectionIndex].lastResponse = now
    this.requests[data.id].executed = 1
    this.requests[data.id].onDataReceived(data.result)
  }

  getBlockHeader (height) {
    var requestString = '{ "id": "[ID]", "method":"blockchain.block.get_header", "params": ["' + height + '"] }'
    return this.write(requestString)
  }

  getTransaction (transactionID) {
    // console.log("Getting transaction ", transactionID)
    var requestString = '{ "id": "[ID]", "method":"blockchain.transaction.get", "params":["' + transactionID + '"] }'
    if (this.cache[transactionID]) {
      // console.log("USING CACHE", transactionID)
      var transaction = this.cache[transactionID].data
      return new Promise((resolve, reject) => {
        resolve(transaction)
      })
    } else {
      // console.log("NOT USING CACHE", transactionID)
    }
    return this.write(requestString)
  }
}
