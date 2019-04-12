// @flow

import 'regenerator-runtime/runtime'

import EventEmitter from 'eventemitter3'

import { makeEdgeCorePlugins } from './plugin/currencyPlugin.js'

const DEFAULT_PROTOCOL = 'echo-protocol'

const createTcpSocket = io =>
  class TcpSocket extends EventEmitter {
    connect ({ host, port }) {
      const uri = `ws://${this.host}:${this.port}/`
      const socket = new io.WebSocket(uri, DEFAULT_PROTOCOL)

      const { send, close } = socket
      this.write = send
      this.destroy = close
      this.end = close

      socket.onclose = ({ code, reason, wasClean }) =>
        (!wasClean && this.emit('error', reason)) || this.emit('close')
      socket.onopen = () => this.emit('connect')
      socket.onmessage = ({ data }) => this.emit('data', data)
    }
  }

window.addEdgeCorePlugins(
  makeEdgeCorePlugins(({ io, nativeIo }) => ({
    ...io,
    ...nativeIo['edge-currency-bitcoin'],
    Socket: createTcpSocket(io)
  }))
)
