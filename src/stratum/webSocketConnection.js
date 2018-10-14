// @flow

import { StratumConnection } from './stratumConnection.js'

export class WebSocketConnection {
  stratumConnection: StratumConnection
  scheme: string
  host: string
  port: number
  io: Object
  wsSocket: Object

  constructor (stratumConnection: StratumConnection, io: Object, parsed: Object) {
    this.stratumConnection = stratumConnection
    this.scheme = parsed.scheme
    this.host = parsed.host
    this.port = Number(parsed.port)
    this.io = io
  }

  init () {
    this.wsSocket = new this.io.WebSocket()
    this.wsSocket.onerror((error) => {
      console.log('Connection Error: ' + error.toString())
    })
    this.wsSocket.onopen(() => {
      this.stratumConnection.onSocketConnect(this)
    })
    this.wsSocket.onmessage((message) => {
      if (message.type === 'utf8') {
        console.log("Received: '" + message.utf8Data + "'")
        this.stratumConnection.onSocketData(message)
      }
    })
    this.wsSocket.onclose(() => {
        console.log('echo-protocol Connection Closed')
        this.stratumConnection.onSocketClose(false)
      })
    })
    this.wsSocket.connect('ws://localhost:8080/', 'echo-protocol')
  }

  write (data: string) {
    this.wsSocket.send(data)
  }

  destroy (error: any) {
  }

  end () {

  }
}
