// @flow

import { bridgifyObject, emit, onMethod } from 'yaob'

import { type EdgeSocket, type EdgeSocketOptions } from '../../types/plugin.js'

/**
 * Wraps a Node-style socket into an EdgeSocket.
 */
export function makeEdgeSocket (
  socket: net$Socket,
  opts: EdgeSocketOptions
): EdgeSocket {
  const out: EdgeSocket = {
    on: onMethod,

    async connect (): Promise<mixed> {
      socket.setEncoding('utf8')
      socket.on('close', (hadError: boolean) => emit(out, 'close'))
      socket.on('error', (error: Error) => emit(out, 'error', error))
      socket.on('data', (data: string) => emit(out, 'message', String(data)))
      socket.on('connect', () => emit(out, 'open'))
      socket.connect({ host: opts.host, port: opts.port })
    },

    send (data: string) {
      socket.write(data, 'utf8')
      return Promise.resolve()
    },

    close () {
      socket.destroy()
      return Promise.resolve()
    }
  }
  bridgifyObject(out)
  return out
}
