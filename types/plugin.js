// @flow

import { type Subscriber } from 'yaob'
import { type EdgeIo, type EdgeCurrencyInfo } from 'edge-core-js/types'
import { type EngineCurrencyInfo } from './engine.js'

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

/**
 * The extra things we need to add to the EdgeIo object.
 */
export type ExtraIo = {
  +secp256k1?: EdgeSecp256k1,
  +pbkdf2?: EdgePbkdf2,
  makeSocket(opts: EdgeSocketOptions): Promise<EdgeSocket>
}

/**
 * The IO object this plugin uses internally.
 */
export type PluginIo = EdgeIo & ExtraIo

export type CurrencySettings = {
  customFeeSettings: Array<string>,
  electrumServers: Array<string>,
  disableFetchingServers?: boolean
}

/**
 * This object holds the plugin-wide per-currency caches.
 * Engine plugins are responsible for keeping it up to date.
 */
export type PluginStateSettings = {
  io: EdgeIo,
  electrumServersUrl: string,
  defaultSettings: CurrencySettings,
  currencyCode: string,
  pluginName: string
}

export type ServerInfo = {
  serverUrl: string,
  serverScore: number,
  responseTime: number,
  numResponseTimes: number
}

export type CurrencyPluginSettings = {
  currencyInfo: EdgeCurrencyInfo,
  engineInfo: EngineCurrencyInfo
}
