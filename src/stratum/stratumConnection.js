// @flow
import { parse } from 'uri-js'

import { fetchVersion } from './stratumMessages.js'
import type { StratumBlockHeader } from './stratumMessages.js'

export type OnFailHandler = (error: Error) => void

// Timing can vary a little in either direction for fewer wakeups:
export const TIMER_SLACK = 500
export const KEEPALIVE_MS = 60000

/**
 * This is a private type used by the Stratum connection.
 * Use the static task-creator methods to build these.
 */
export interface StratumTask {
  method: string;
  params: Array<any>;
  +onDone: (reply: any) => void;
  +onFail: OnFailHandler;
}

export interface StratumCallbacks {
  +onOpen?: (uri: string) => void;
  +onClose?: (uri: string, hadError: boolean) => void;
  +onQueueSpace?: (uri: string) => StratumTask | void;

  onNotifyHeader?: (uri: string, headerInfo: StratumBlockHeader) => void;
  +onNotifyScriptHash?: (uri: string, scriptHash: string, hash: string) => void;
}

export interface StratumOptions {
  callbacks: StratumCallbacks;
  io: any;
  queueSize?: number; // defaults to 10
  timeout?: number; // seconds, defaults to 30
}

function nop () {}

/**
 * A connection to a Stratum server.
 * Manages the underlying TCP sockect, as well as message framing,
 * queue depth, error handling, and so forth.
 */
export class StratumConnection {
  uri: string
  connected: boolean
  log: Function

  constructor (uri: string, options: StratumOptions, log: ?Function) {
    const { callbacks = {}, io, queueSize = 10, timeout = 30 } = options
    const {
      onOpen = nop,
      onClose = nop,
      onQueueSpace = nop,
      onNotifyHeader = nop,
      onNotifyScriptHash = nop
    } = callbacks

    this.log = log || console.log
    this.io = io
    this.onClose = onClose
    this.onOpen = onOpen
    this.onQueueSpace = onQueueSpace
    this.onNotifyHeader = onNotifyHeader
    this.onNotifyScriptHash = onNotifyScriptHash
    this.queueSize = queueSize
    this.timeout = 1000 * timeout
    this.uri = uri

    // Message queue:
    this.nextId = 0
    this.pendingMessages = {}
  }

  /**
   * Activates the underlying TCP connection.
   */
  open () {
    const parsed = parse(this.uri)
    if (
      (parsed.scheme !== 'electrum' && parsed.scheme !== 'electrums') ||
      !parsed.host ||
      !parsed.port
    ) {
      throw new TypeError(`Bad stratum URI: ${this.uri}`)
    }

    // Connect to the server:
    const socket =
      parsed.scheme === 'electrums'
        ? new this.io.TLSSocket()
        : new this.io.Socket()
    socket.setEncoding('utf8')
    socket.on('close', (hadError: boolean) => this.onSocketClose(hadError))
    socket.on('error', (e: Error) => this.log(e))
    socket.on('connect', () => this.onSocketConnect(socket))
    socket.on('data', (data: string) => this.onSocketData(data))
    socket.connect({
      host: parsed.host,
      port: Number(parsed.port)
    })
    this.socket = socket
    this.needsDisconnect = false
  }

  /**
   * Re-triggers the `onQueueSpace` callback if there is space in the queue.
   */
  wakeup () {
    while (Object.keys(this.pendingMessages).length < this.queueSize) {
      const task = this.onQueueSpace(this.uri)
      if (!task) break
      this.submitTask(task)
    }
  }

  /**
   * Forcefully sends a task to the Stratum server,
   * ignoring the queue checks. This should *only* be used for spends.
   * This will fail if the connection is not connected.
   */
  submitTask (task: StratumTask) {
    // Add the message to the queue:
    const id = ++this.nextId
    this.pendingMessages[id.toString()] = {
      task,
      startTime: Date.now()
    }

    // Send the message:
    this.transmitMessage(id, task)
  }

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------

  // Options:
  io: any
  queueSize: number
  timeout: number // Converted to ms

  // Callbacks:
  onClose: (uri: string, hadError: boolean) => void
  onOpen: (uri: string) => void
  onQueueSpace: (uri: string) => StratumTask | void
  onNotifyHeader: (uri: string, headerInfo: StratumBlockHeader) => void
  onNotifyScriptHash: (uri: string, scriptHash: string, hash: string) => void

  // Message queue:
  nextId: number
  pendingMessages: {
    [id: string]: {
      startTime: number,
      task: StratumTask
    }
  }

  // Connection state:
  needsDisconnect: boolean
  lastKeepalive: number
  partialMessage: string
  socket: net$Socket | void
  timer: number

  /**
   * Called when the socket disconnects for any reason.
   */
  onSocketClose (hadError: boolean) {
    clearTimeout(this.timer)
    this.connected = false
    this.socket = void 0
    this.needsDisconnect = false
    const e: Error = hadError
      ? new Error('Stratum TCP socket error')
      : new Error('Connection closed')
    for (const id of Object.keys(this.pendingMessages)) {
      const message = this.pendingMessages[id]
      try {
        message.task.onFail(e)
      } catch (e) {
        this.log(e)
      }
    }
    this.pendingMessages = {}
    try {
      this.onClose(this.uri, hadError)
    } catch (e) {
      this.log(e)
    }
  }

  /**
   * Called when the socket completes its connection.
   */
  onSocketConnect (socket: net$Socket) {
    if (this.needsDisconnect) {
      if (this.socket) this.socket.end()
      return
    }

    this.connected = true
    this.lastKeepalive = Date.now()
    this.partialMessage = ''

    try {
      this.onOpen(this.uri)
    } catch (e) {
      this.close(e)
    }

    // Launch pending messages:
    for (const id of Object.keys(this.pendingMessages)) {
      const message = this.pendingMessages[id]
      this.transmitMessage(Number(id), message.task)
    }

    this.setupTimer()
    this.wakeup()
  }

  /**
   * Called when the socket receives data.
   */
  onSocketData (data: string) {
    const buffer = this.partialMessage + data
    const parts = buffer.split('\n')
    for (let i = 0; i + 1 < parts.length; ++i) {
      this.onMessage(parts[i])
    }
    this.partialMessage = parts[parts.length - 1]
  }

  /**
   * Called when the socket receives a complete message.
   */
  onMessage (messageJson: string) {
    try {
      // const start = Date.now()
      const json = JSON.parse(messageJson)

      if (json.id) {
        // We have an ID, so it's a reply to a single request:
        const id: string = json.id.toString()
        const message = this.pendingMessages[id]
        if (!message) {
          throw new Error(`Bad Stratum id in ${messageJson}`)
        }
        delete this.pendingMessages[id]
        try {
          message.task.onDone(json.result)
        } catch (e) {
          message.task.onFail(e)
        }
      } else if (json.method === 'blockchain.headers.subscribe') {
        try {
          // TODO: Validate
          this.onNotifyHeader(this.uri, json.params[0])
        } catch (e) {
          this.log(e)
        }
      } else if (json.method === 'blockchain.scripthash.subscribe') {
        try {
          // TODO: Validate
          this.onNotifyScriptHash(this.uri, json.params[0], json.params[1])
        } catch (e) {
          this.log(e)
        }
      } else if (/subscribe$/.test(json.method)) {
        // It's some other kind of subscription.
      } else {
        throw new Error(`Bad Stratum reply ${messageJson}`)
      }
    } catch (e) {
      this.close(e)
    }
    this.wakeup()
  }

  /**
   * Called when the timer expires.
   */
  onTimer () {
    const now = Date.now() - TIMER_SLACK

    if (this.lastKeepalive + KEEPALIVE_MS < now) {
      this.submitTask(
        fetchVersion((version: string) => {}, (e: Error) => this.close(e))
      )
    }

    for (const id of Object.keys(this.pendingMessages)) {
      const message = this.pendingMessages[id]
      if (message.startTime + this.timeout < now) {
        try {
          message.task.onFail(new Error('Timeout'))
        } catch (e) {
          this.log(e)
        }
        delete this.pendingMessages[id]
      }
    }
    this.setupTimer()
  }

  /**
   * Call whenever we want to close the connection for any reason
   */
  close (e?: Error) {
    this.connected = false
    clearTimeout(this.timer)
    if (!this.connected) this.needsDisconnect = true
    if (this.socket) this.socket.destroy(e)
  }

  setupTimer () {
    // Find the next time something needs to happen:
    let nextWakeup = this.lastKeepalive + KEEPALIVE_MS

    for (const id of Object.keys(this.pendingMessages)) {
      const message = this.pendingMessages[id]
      const timeout = message.startTime + this.timeout
      if (timeout < nextWakeup) nextWakeup = timeout
    }

    const now = Date.now() - TIMER_SLACK
    const delay = nextWakeup < now ? 0 : nextWakeup - now
    this.timer = setTimeout(() => this.onTimer(), delay)
  }

  transmitMessage (id: number, task: StratumTask) {
    if (this.socket && this.connected && !this.needsDisconnect) {
      // If this is a keepalive, record the time:
      if (task.method === 'server.version') {
        this.lastKeepalive = Date.now()
      }

      const message = {
        id,
        method: task.method,
        params: task.params
      }
      this.socket.write(JSON.stringify(message) + '\n')
    }
  }
}
