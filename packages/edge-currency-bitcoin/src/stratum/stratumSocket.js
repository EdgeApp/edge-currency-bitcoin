// @flow

import EventEmitter from 'eventemitter3'
import { type PluginIo } from '../../types/plugin.js'

const DEFAULT_PROTOCOL = 'echo-protocol'

export class StratumSocket extends EventEmitter {
  constructor (io: PluginIo, { host, port }) {
    super()
    this.host = host
    this.port = port
    this.uri = `ws://${this.host}:${this.port}/`
    this.socket = new io.WebSocket()

    this.socket.onclose(() => this.emit('close'))
    this.socket.onerror(error => this.emit('error', error))
    this.socket.onopen(() => this.emit('open'))
    this.socket.onmessage(message => this.emit('message', message))
  }

  // API
  // a connect that works without params
  connect () {
    this.socket.connect(this.uri, DEFAULT_PROTOCOL)
  }

  // receives data then sends (returns void)
  send (data: string) {
    return this.socket.write(data)
  }
}
