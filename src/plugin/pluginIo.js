// @flow

import { type EdgeIo } from 'edge-core-js/types'
import { type Subscriber, bridgifyObject, emit, onMethod } from 'yaob'

export type EdgeSecp256k1 = {
  publicKeyCreate: (
    privateKey: Uint8Array,
    compressed: boolean
  ) => Promise<string>,
  privateKeyTweakAdd: (
    privateKey: Uint8Array,
    tweak: Uint8Array
  ) => Promise<Uint8Array>,
  publicKeyTweakAdd: (
    publicKey: Uint8Array,
    tweak: Uint8Array,
    compressed: boolean
  ) => Promise<Uint8Array>
}

export type EdgePbkdf2 = {
  deriveAsync: (
    key: Uint8Array,
    salt: Uint8Array,
    iter: number,
    len: number,
    algo: string
  ) => Promise<Uint8Array>
}

/**
 * Wrapper for TCP sockets with event & method names based on WebSocket.
 */
export type EdgeSocket = {
  +on: Subscriber<{
    close: void, // The socket is closed for any reason.
    error: any, // An network error occurred.
    message: string, // The socket has received data.
    open: void // The socket is opened.
  }>,

  /**
   * Connects to a server & resolves when finished.
   * Must only be called once.
   */
  connect(): Promise<mixed>,

  /**
   * Transmits data to the server. Must only be called on open sockets.
   */
  send(data: string): Promise<mixed>,

  /**
   * Shuts down the socket. No other methods are callable after this.
   */
  close(): Promise<mixed>
}

export type EdgeSocketOptions = {
  host: string,
  port?: number,
  type: 'tcp' | 'tls'
}

export type SigmaMintOptions = {
  denomination: number,
  privateKey: string,
  index: number
}

export type SigmaMint = {
  commitment: string,
  serialNumber: string
}

export type SigmaSpendOptions = {
  denomination: number,
  privateKey: string,
  index: number,
  anonymitySet: string[],
  groupId: number,
  blockHash: string,
  txHash: string
}

/**
 * Wraps a Node-style socket into an EdgeSocket.
 */
export function makeEdgeSocket(
  socket: net$Socket,
  opts: EdgeSocketOptions
): EdgeSocket {
  const out: EdgeSocket = {
    on: onMethod,

    async connect(): Promise<mixed> {
      socket.setEncoding('utf8')
      socket.on('close', (hadError: boolean) => emit(out, 'close'))
      socket.on('error', (error: Error) => emit(out, 'error', error))
      socket.on('data', (data: string) => emit(out, 'message', String(data)))
      socket.on('connect', () => emit(out, 'open'))
      socket.connect({ host: opts.host, port: opts.port })
    },

    send(data: string) {
      socket.write(data, 'utf8')
      return Promise.resolve()
    },

    close() {
      socket.destroy()
      return Promise.resolve()
    }
  }
  bridgifyObject(out)
  return out
}

/**
 * The extra things we need to add to the EdgeIo object.
 */
export type ExtraIo = {
  +secp256k1?: EdgeSecp256k1,
  +pbkdf2?: EdgePbkdf2,
  sigmaMint(opts: SigmaMintOptions): Promise<SigmaMint>,
  sigmaSpend(opts: SigmaSpendOptions): Promise<string>,
  makeSocket(opts: EdgeSocketOptions): Promise<EdgeSocket>
}

/**
 * The IO object this plugin uses internally.
 */
export type PluginIo = EdgeIo & ExtraIo
