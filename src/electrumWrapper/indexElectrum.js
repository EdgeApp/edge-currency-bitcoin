// @flow

const RETRY_CONNECTION = 500
const MAX_HEIGHT_BOUNDRY = 50

export class Electrum {
  globalRecievedData: any
  connected: boolean
  io: any
  currentConnID: string
  lastKnownBlockHeight: number
  connections: any
  requests: any
  maxHeight: number
  id: number
  serverList: Array<Array<string>>
  subscribers: {
    address: any,
    numblocks: any
  }

  constructor (serverList: Array<Array<string>>, callbacks: any, io: any, lastKnownBlockHeight: number = 0) {
    this.io = io
    this.connections = {}
    this.requests = {}
    this.serverList = serverList
    this.globalRecievedData = {}
    this.lastKnownBlockHeight = lastKnownBlockHeight
    this.maxHeight = lastKnownBlockHeight
    this.subscribers = {
      address: callbacks.onAddressStatusChanged,
      numblocks: callbacks.onBlockHeightChanged
    }
    this.currentConnID = ''
    this.id = 0
  }

  getID (): number {
    return this.id++
  }

  getNextConn (): string {
    const connectionIDs = Object.keys(this.connections)
    const currentIDIndex = connectionIDs.indexOf(this.currentConnID)
    for (let i = currentIDIndex + 1; i < connectionIDs.length; i++) {
      const connectionID = connectionIDs[i]
      if (this.connections[connectionID]._state === 2) {
        this.currentConnID = connectionID
        return this.currentConnID
      }
    }
    for (let i = 0; i < currentIDIndex; i++) {
      const connectionID = connectionIDs[i]
      if (this.connections[connectionID]._state === 2) {
        this.currentConnID = connectionID
        return this.currentConnID
      }
    }
    return this.currentConnID
  }

  compileDataCallback (connectionID: string) {
    return (data: any) => {
      let string = data.toString('utf8')
      if (!this.globalRecievedData[connectionID]) {
        this.globalRecievedData[connectionID] = ''
      }
      this.globalRecievedData[connectionID] += string
      let result = []
      if (this.globalRecievedData[connectionID].includes('\n')) {
        let mdata = this.globalRecievedData[connectionID].split('\n')
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
        this.globalRecievedData[connectionID] = mdata.slice(k, mdata.length).join('')
      } else {
        try {
          const res = JSON.parse(this.globalRecievedData[connectionID])
          result.push(res)
          this.globalRecievedData[connectionID] = ''
        } catch (e) {}
      }
      result.forEach(r => this.handleData(r))
    }
  }

  netConnect (host: string, port: string, callback: any): any {
    let connection = new this.io.net.Socket()
    // We can have more then 10 reads/writes waiting and we don't want to throttle
    connection.setMaxListeners(0)

    const gracefullyCloseConn = () => {
      const myConnectionID = `${host}:${port}`
      // Changing our connection state to closed
      connection._state = 0
      let newRequests = []
      // Getting the requests for the closed connection
      for (let id in this.requests) {
        if (this.requests[id].connectionID === myConnectionID) {
          newRequests.push(this.requests[id])
        }
      }
      let workingConnID = ''
      // Getting A working connection index
      for (const connectionID in this.connections) {
        if (this.connections[connectionID]._state === 2) {
          workingConnID = connectionID
          break
        }
      }
      // If we have a working connection we will transfer all work to him
      if (workingConnID !== '') {
        newRequests.forEach(request => {
          request.connectionID = workingConnID
          this.socketWriteAbstract(workingConnID, request.data)
        })
      } else { // If we don't have a working connection we will try again on this connection
        newRequests.forEach(request => {
          setTimeout(() => {
            this.socketWriteAbstract(myConnectionID, request.data)
          }, RETRY_CONNECTION)
        })
      }
    }

    connection.on('connect', () => {
      connection._state = 2
      this.write('blockchain.numblocks.subscribe', [], `${host}:${port}`).then(height => {
        if (this.lastKnownBlockHeight && height < this.lastKnownBlockHeight) {
          connection._state = 0
          connection.destroy()
          delete this.connections[`${host}:${port}`]
        } else {
          connection.blockchainHeight = height
          this.maxHeight = Math.max(this.maxHeight, height)
        }
        for (const connectionID in this.connections) {
          const height = this.connections[connectionID].blockchainHeight
          if (height < (this.maxHeight - MAX_HEIGHT_BOUNDRY)) {
            this.connections[connectionID]._state = 0
            this.connections[connectionID].destroy()
            delete this.connections[connectionID]
          }
        }
        if (this.connections[`${host}:${port}`]) connection.emit('finishedConnecting')
      })
    })
    connection.on('data', callback)
    connection.on('close', gracefullyCloseConn)
    connection.on('error', gracefullyCloseConn)
    connection.on('end', gracefullyCloseConn)
    connection.connect(port, host)
    return connection
  }

  connect () {
    for (let i = 0; i < this.serverList.length; i++) {
      const server = this.serverList[i]
      const [host, port] = server
      const callback = this.compileDataCallback(`${host}:${port}`)
      const connection = this.netConnect(host, port, callback)
      if (!this.currentConnID) this.currentConnID = `${host}:${port}`
      connection._state = 1
      this.connections[`${host}:${port}`] = connection
    }
  }

  stop () {
    for (let i = 0; i < this.connections.length; i++) this.connections.destroy()
  }

  socketWriteAbstract (connectionID: string, data: any) {
    switch (this.connections[connectionID]._state) {
      case 0:
        let callback = this.compileDataCallback(connectionID)
        const [host, port] = connectionID.split(':')
        this.netConnect(host, port, callback).then(() => {
          this.connections[connectionID].write(data + '\n')
        })
        break
      case 1:
        this.connections[connectionID].once('finishedConnecting', () => {
          this.connections[connectionID].write(data + '\n')
        })
        break
      case 2:
        this.connections[connectionID].write(data + '\n')
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
      const request = this.requests[data.id]
      if (!data.error) {
        request.onDataReceived(data.result)
        delete this.requests[data.id]
        return
      }
      const currentID = request.connectionID
      const workingConnID = this.getNextConn()
      if (currentID !== workingConnID) {
        request.connectionID = workingConnID
        this.socketWriteAbstract(workingConnID, request.data)
      } else {
        request.onFailure(data.error)
      }
    }
  }

  write (method: string, params: Array<any>, connectionID: ?any): Promise<any> {
    let rejectProxy, resolveProxy
    const id = this.getID().toString()
    const nextConnectionID = connectionID || this.getNextConn()
    const data = JSON.stringify({ id, method, params })

    const out = new Promise((resolve, reject) => {
      resolveProxy = resolve
      rejectProxy = resolve
    })

    this.requests[id] = {
      data: data,
      connectionID: nextConnectionID,
      onDataReceived: resolveProxy,
      onFailure: rejectProxy
    }
    this.socketWriteAbstract(nextConnectionID, data)
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
