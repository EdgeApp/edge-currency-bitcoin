// @flow

export class Electrum {
  globalRecievedData: Array<string>
  connected: boolean
  io: any
  currentConn: number
  connections: Array<any>
  requests: any
  id: number
  serverList: Array<Array<string>>
  subscribers: {
    address: any,
    numblocks: any
  }
  constructor (serverList: Array<Array<string>>, callbacks: any, io: any) {
    this.connected = false
    this.io = io
    this.connections = []
    this.requests = {}
    this.serverList = serverList
    this.globalRecievedData = Array(serverList.length).fill('')
    this.subscribers = {
      address: callbacks.onAddressStatusChanged,
      numblocks: callbacks.onBlockHeightChanged
    }
    this.currentConn = 0
    this.id = 0
  }

  getID (): number {
    return this.id++
  }
  getNextConn (): number {
    if (this.currentConn === this.serverList.length - 1) {
      this.currentConn = 0
    } else this.currentConn++
    return this.currentConn
  }

  compileDataCallback (index: number) {
    return (data: any) => {
      let string = data.toString('utf8')
      this.globalRecievedData[index] += string
      let result = []
      if (this.globalRecievedData[index].includes('\n')) {
        let mdata = this.globalRecievedData[index].split('\n')
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
        this.globalRecievedData[index] = mdata.slice(k, mdata.length).join('')
      } else {
        try {
          const res = JSON.parse(this.globalRecievedData[index])
          result.push(res)
          this.globalRecievedData[index] = ''
        } catch (e) {}
      }
      result.forEach(r => this.handleData(r))
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

    connection._state = 1

    let now = Date.now()

    const gracefullyCloseConn = () => {
      connection._state = 0
      for (let id in this.requests) {
        const request = this.requests[id]
        if (request.connectionIndex === i) {
          const { method, params } = JSON.parse(request.data)
          this.write(method, params)
          delete this.requests[id]
        }
      }
    }

    connection.on('data', callback)
    connection.on('close', e => {
      console.log(`gracefullyCloseConn for reason: !!!close!!!`)
      gracefullyCloseConn()
    })
    connection.on('error', e => {
      console.log(`gracefullyCloseConn for reason: !!!error!!!`)
      gracefullyCloseConn()
    })
    connection.on('end', e => {
      console.log(`gracefullyCloseConn for reason: !!!end!!!`)
      gracefullyCloseConn()
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
    this.serverList.forEach((server: Array<string>, index: number) => {
      let callback = this.compileDataCallback(index)
      this.netConnect(server[1], server[0], callback, -1)
    })
  }

  socketWriteAbstract (index: number, data: any) {
    switch (this.connections[index].conn._state) {
      case 0:
        var callback = this.compileDataCallback(index)
        this.netConnect(this.serverList[index][1], this.serverList[index][0], callback, index)
        break
      case 1:
        this.connections[index].prom.then(() => {
          this.connections[index].conn.write(data + '\n')
        })
        break
      case 2:
        this.connections[index].conn.write(data + '\n')
        break
    }
  }

  handleData (data: any) {
    if (data.method) {
      const method = data.method.split('.')
      if (method.length === 3 && method[2] === 'subscribe') {
        this.subscribers[method[1]](...data.params)
      }
    } else if (typeof this.requests[data.id] === 'object') {
      this.requests[data.id].onDataReceived(data.result)
      delete this.requests[data.id]
    }
  }

  write (method: string, params: Array<any>): Promise<any> {
    let rejectProxy, resolveProxy
    const id = this.getID().toString()
    const nextConnection = this.getNextConn()
    const data = JSON.stringify({ id, method, params })

    const out = new Promise((resolve, reject) => {
      resolveProxy = resolve
      rejectProxy = resolve
    })

    this.requests[id] = {
      data: data,
      connectionIndex: nextConnection,
      onDataReceived: resolveProxy,
      onFailure: rejectProxy
    }
    this.socketWriteAbstract(nextConnection, data)
    return out
  }

  subscribeToAddress (address: string): Promise<any> {
    return this.write('blockchain.address.subscribe', [address])
  }

  subscribeToBlockHeight (): Promise<any> {
    return this.write('blockchain.numblocks.subscribe', [])
  }

  getEstimateFee (blocksToBeIncludedIn: string): Promise<any> {
    return this.write('blockchain.estimatefee', [blocksToBeIncludedIn])
  }

  getAddresHistory (address: string): Promise<any> {
    return this.write('blockchain.address.get_history', [address])
  }

  broadcastTransaction (tx: string): Promise<any> {
    return this.write('blockchain.transaction.broadcast', [tx])
  }

  getBlockHeader (height: number): Promise<any> {
    return this.write('blockchain.block.get_header', [height])
  }

  getTransaction (transactionID: string): Promise<any> {
    return this.write('blockchain.transaction.get', [transactionID])
  }
}
