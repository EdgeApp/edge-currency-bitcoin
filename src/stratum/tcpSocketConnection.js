// @flow

import { StratumConnection } from './stratumConnection.js'

export class TcpSocketConnection {
  stratumConnection: StratumConnection
  scheme: string
  host: string
  port: number
  io: Object
  socket: Object
  // socket: net$Socket

  constructor (stratumConnection: StratumConnection, io: Object, parsed: Object) {
    this.stratumConnection = stratumConnection
    this.scheme = parsed.scheme
    this.host = parsed.host
    this.port = Number(parsed.port)
    this.io = io
  }

  init () {
    if (this.scheme === 'electrum') {
      this.socket = new this.io.Socket()
    } else if (this.scheme === 'electrums') {
      this.socket = new this.io.TLSSocket()
    } else {
      return false
    }
    this.socket.setEncoding('utf8')
    this.socket.on('close', (hadError: boolean) => this.stratumConnection.onSocketClose(hadError))
    this.socket.on('error', (e: Error) => {
      this.stratumConnection.error = e
    })
    this.socket.on('connect', () => this.stratumConnection.onSocketConnect(this))
    this.socket.on('data', (data: string) => this.stratumConnection.onSocketData(data))
    this.socket.connect({
      host: this.host,
      port: this.port
    })
  }

  write (data: string) {
    return this.write(data + '\n')
  }

  destroy (error: any) {
    return this.destroy(error)
  }

  end () {
    return this.socket.end()
  }
}
