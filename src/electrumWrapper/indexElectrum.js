// @flow

const MAX_HEIGHT_BOUNDRY = 50
const MAX_QUEUE_SIZE = 10
const MAX_NUM_OF_SERVERS = 4
const REQUEST_TIMEOUT = 5000

export class Electrum {
  globalRecievedData: any
  io: any
  currentConnID: string
  lastKnownBlockHeight: number
  connections: any
  requests: any
  maxHeight: number
  id: number
  serverList: Array<{
    server: Array<string>,
    valid: boolean
  }>
  subscribers: {
    scripthash: any,
    address: any,
    headers: any
  }

  constructor (serverList: Array<Array<string>>, callbacks: any, io: any, lastKnownBlockHeight: number = 0) {
    this.io = io
    this.connections = {}
    this.requests = {}
    this.serverList = serverList.map(server => ({server, valid: true}))
    this.globalRecievedData = {}
    this.lastKnownBlockHeight = lastKnownBlockHeight || 0
    this.maxHeight = lastKnownBlockHeight
    this.subscribers = {
      scripthash: callbacks.onAddressStatusChanged,
      address: callbacks.onAddressStatusChanged,
      headers: callbacks.onBlockHeightChanged
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
    const right = connectionIDs.slice(currentIDIndex + 1)
    const left = connectionIDs.slice(0, currentIDIndex)
    const connectionsToSelect = left.concat(right)
    for (let i = 0; i < connectionsToSelect.length; i++) {
      const connectionID = connectionsToSelect[i]
      if (this.connections[connectionID].connection._state === 2) {
        this.currentConnID = connectionID
        return this.currentConnID
      }
    }
    if (this.connections[this.currentConnID] &&
    this.connections[this.currentConnID].connection._state === 2) {
      return this.currentConnID
    } else return ''
  }

  connect () {
    let maxNumOfServers = MAX_NUM_OF_SERVERS - Object.keys(this.connections).length
    for (let i = 0; i < this.serverList.length && i < maxNumOfServers; i++) {
      if (this.serverList[i].valid) {
        const [host, port] = this.serverList[i].server
        const myConnectionID = `${host}:${port}`
        if (!this.connections[myConnectionID]) {
          let connection = new this.io.net.Socket()
          this.connections[myConnectionID] = {
            connection,
            queueSize: 0,
            blockchainHeight: 0,
            responses: 0
          }
          connection._state = 1
          connection.setMaxListeners(0)
          connection.on('connect', () => this.onOpenConnection(myConnectionID))
          connection.on('data', this.compileDataCallback(myConnectionID))
          connection.on('close', () => this.gracefullyCloseConn(myConnectionID))
          connection.on('error', () => this.gracefullyCloseConn(myConnectionID))
          connection.on('end', () => this.gracefullyCloseConn(myConnectionID))
          connection.connect(port, host)
          if (!this.currentConnID) this.currentConnID = myConnectionID
        } else {
          maxNumOfServers += 1
        }
      }
    }
  }

  onOpenConnection (myConnectionID: string) {
    const {connection} = this.connections[myConnectionID]

    const createInitialRequest = (method: string, params: Array<any>, connectionID: string) => {
      let onFailure, onDataReceived
      const out = new Promise((resolve, reject) => {
        onDataReceived = resolve
        onFailure = reject
      })
      const id = this.getID().toString()
      const requestString = JSON.stringify({ id, method, params })
      this.requests[id] = { id, requestString, connectionID, onDataReceived, onFailure }
      this.connections[connectionID].connection.write(requestString + '\n')
      return out
    }

    createInitialRequest('server.version', ['1.1', '1.1'], myConnectionID)
    .then(versionResponse => {
      if (!Array.isArray(versionResponse.result) || versionResponse.result[1] !== '1.1') {
        throw new Error('Wrong Protocol Version')
      }
      return createInitialRequest('blockchain.headers.subscribe', [], myConnectionID)
    })
    .then(headerResponse => {
      const header = headerResponse.result
      const height = header.block_height
      if (height < this.lastKnownBlockHeight) {
        throw new Error('Block height too low')
      }
      this.connections[myConnectionID].blockchainHeight = height
      this.maxHeight = Math.max(this.maxHeight, height)
      for (const connectionID in this.connections) {
        const height = this.connections[connectionID].blockchainHeight
        if (height > (this.maxHeight + MAX_HEIGHT_BOUNDRY)) {
          this.clearConnection(connectionID)
        }
      }
      if (this.connections[myConnectionID]) {
        connection._state = 2
        connection.emit('finishedConnecting')
        headerResponse.params = [headerResponse.result]
        this.subscribers.headers(headerResponse)
      } else {
        throw new Error('Block height too high')
      }
    })
    .catch(e => {
      console.log(e)
      this.serverList.forEach(({server}, index) => {
        if (`${server[0]}:${server[1]}` === myConnectionID) this.serverList[index].valid = false
      })
      this.clearConnection(myConnectionID)
    })
  }

  gracefullyCloseConn (myConnectionID: string) {
    if (this.connections[myConnectionID]) {
      const {connection} = this.connections[myConnectionID]
      connection._state = 0
      // Changing our connection state to closed
      const closingConnectionRequests = []
      // Getting the requests for the closed connection
      for (const id in this.requests) {
        if (this.requests[id].connectionID === myConnectionID) {
          closingConnectionRequests.push(this.requests[id])
        }
      }
      // Getting A working connection index
      const workingConnID = this.getNextConn()

      // If we have a working connection we will transfer all work to him
      if (workingConnID !== '') {
        closingConnectionRequests.forEach(request => {
          request.connectionID = workingConnID
          this.write(request)
        })
      } else { // If we don't have a working connection we will clear the request and throw an error
        const error = new Error('No connected servers')
        for (const id in this.requests) {
          clearTimeout(this.requests[id].timer)
          this.requests[id].onFailure(error)
          delete this.requests[id]
        }
        this.requests = {}
      }
    }
  }

  clearConnection (connectionIDToClean: string) {
    if (this.connections[connectionIDToClean]) {
      const connection = this.connections[connectionIDToClean].connection
      connection.destroy()
      delete this.connections[connectionIDToClean]
    }
  }

  stop () {
    for (let i = 0; i < this.connections.length; i++) {
      this.clearConnection(this.connections[i])
    }
  }

  createRequest (method: string, params: Array<any>, myConnectionID?: string): Promise<any> {
    const connectionID = myConnectionID || this.getNextConn()
    if (connectionID === '') return Promise.reject(new Error('no live connections'))
    const id = this.getID().toString()
    const requestString = JSON.stringify({ id, method, params })

    let onFailure, onDataReceived
    const out = new Promise((resolve, reject) => {
      onDataReceived = resolve
      onFailure = reject
    })

    this.requests[id] = { id, requestString, connectionID, onDataReceived, onFailure }
    this.write(this.requests[id])
    return out
  }

  write (request: any) {
    let {connectionID, id} = request
    const onFailure = (error) => {
      request.onFailure(new Error(error))
      delete this.requests[id]
    }

    if (!this.connections[connectionID]) {
      connectionID = this.getNextConn()
      if (connectionID === '') return onFailure('no live connections')
      request.connectionID = connectionID
    }

    const chosenConnection = this.connections[connectionID]
    const connectionSocket = chosenConnection.connection

    if (chosenConnection.queueSize > MAX_QUEUE_SIZE) {
      return onFailure('reached max queue size')
    }

    const onSuccess = () => {
      this.connections[connectionID].queueSize += 1
      try {
        connectionSocket.write(request.requestString + '\n')
        this.requests[id].timer = setTimeout(() => {
          if (this.requests[id]) {
            this.connections[connectionID].queueSize -= 1
            onFailure('request timed out')
          }
        }, REQUEST_TIMEOUT)
      } catch (e) {
        this.connections[connectionID].queueSize -= 1
        onFailure(e.message)
      }
    }
    switch (connectionSocket._state) {
      case 0:
        onFailure('connection is closed')
        break
      case 1:
        connectionSocket.once('finishedConnecting', onSuccess)
        break
      case 2:
        onSuccess()
        break
    }
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
      result.forEach(r => (r.connectionID = connectionID) && this.handleData(r))
    }
  }

  handleData (data: any) {
    if (data.method) {
      const method = data.method.split('.')
      if (method.length === 3 && method[2] === 'subscribe') {
        this.subscribers[method[1]](data)
      }
    } else if (typeof this.requests[data.id] === 'object') {
      const request = this.requests[data.id]
      if (this.connections[request.connectionID]) {
        this.connections[request.connectionID].responses += 1
      }
      if (!data.error) {
        request.onDataReceived(data)
      } else {
        let message = data.error
        try {
          message = JSON.parse(message).message
        } catch (e) {}
        request.onFailure(message)
      }
      clearTimeout(this.requests[data.id].timer)
      delete this.requests[data.id]
    }
  }

  subscribeToScriptHash (scriptHash: string, myConnectionID?: string): Promise<any> {
    return this.createRequest('blockchain.scripthash.subscribe', [scriptHash], myConnectionID)
  }

  subscribeToAddress (scriptHash: string, myConnectionID?: string): Promise<any> {
    return this.createRequest('blockchain.address.subscribe', [scriptHash], myConnectionID)
  }

  subscribeToBlockHeaders (myConnectionID?: string): Promise<any> {
    return this.createRequest('blockchain.headers.subscribe', [], myConnectionID)
  }

  getEstimateFee (blocksToBeIncludedIn: string, myConnectionID?: string): Promise<any> {
    return this.createRequest('blockchain.estimatefee', [blocksToBeIncludedIn], myConnectionID)
  }

  getServerVersion (clientVersion: string, protocolVersion?: string, myConnectionID?: string): Promise<any> {
    return this.createRequest('server.version', [clientVersion, protocolVersion], myConnectionID)
  }

  getScriptHashHistory (address: string, myConnectionID?: string): Promise<any> {
    return this.createRequest('blockchain.scripthash.get_history', [address], myConnectionID)
  }

  broadcastTransaction (tx: string, myConnectionID?: string): Promise<any> {
    return this.createRequest('blockchain.transaction.broadcast', [tx], myConnectionID)
  }

  getBlockHeader (height: number, myConnectionID?: string): Promise<any> {
    return this.createRequest('blockchain.block.get_header', [height], myConnectionID)
  }

  getTransaction (transactionID: string, myConnectionID?: string): Promise<any> {
    return this.createRequest('blockchain.transaction.get', [transactionID], myConnectionID)
  }
}
