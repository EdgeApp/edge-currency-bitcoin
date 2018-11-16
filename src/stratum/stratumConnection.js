// @flow
import { parse } from 'uri-js'

import { fetchVersion } from './stratumMessages.js'
import type { StratumBlockHeader } from './stratumMessages.js'

export type OnFailHandler = (error: Error) => void

// Timing can vary a little in either direction for fewer wake ups:
const TIMER_SLACK = 500
const KEEP_ALIVE_MS = 60000

/**
 * This is a private type used by the Stratum connection.
 * Use the static task-creator methods to build these.
 */
export interface StratumTask {
  method: string;
  params: Array<any>;
  +onDone: (reply: any, requestMs: number) => void;
  +onFail: OnFailHandler;
}

export interface StratumCallbacks {
  +onOpen: () => void;
  +onClose: (error?: Error) => void;
  +onQueueSpace: () => StratumTask | void;
  +onNotifyHeader: (headerInfo: StratumBlockHeader) => void;
  +onNotifyScriptHash: (scriptHash: string, hash: string) => void;
  +onTimer: (queryTime: number) => void;
  +onVersion: (version: string, requestMs: number) => void;
}

export interface StratumOptions {
  callbacks: StratumCallbacks;
  io: any;
  queueSize?: number; // defaults to 10
  timeout?: number; // seconds, defaults to 30
  walletId?: string; // for logging purposes
}

type PendingMessage = {
  startTime: number,
  task: StratumTask
}

/**
 * A connection to a Stratum server.
 * Manages the underlying TCP socket, as well as message framing,
 * queue depth, error handling, and so forth.
 */
export class StratumConnection {
  uri: string
  connected: boolean
  version: string | void
  errStr: (e: Error) => string

  constructor (uri: string, options: StratumOptions) {
    const {
      callbacks,
      io,
      queueSize = 10,
      timeout = 30,
      walletId = ''
    } = options
    this.errStr = e => `${walletId} - ${e.toString()}`
    this.io = io
    this.callbacks = callbacks
    this.queueSize = queueSize
    this.timeout = 1000 * timeout
    this.uri = uri
    this.sigkill = false

    // Message queue:
    this.nextId = 0
    this.pendingMessages = {}

    // Send a version message before anything else:
    this.submitTask(
      fetchVersion(
        (version: string, requestMs: number) => {
          this.version = version
          this.callbacks.onVersion(version, requestMs)
        },
        (e: Error) => this.close(e)
      )
    )
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
    socket.on('error', (e: Error) => {
      this.error = e
    })
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
  wakeUp () {
    while (Object.keys(this.pendingMessages).length < this.queueSize) {
      const task = this.callbacks.onQueueSpace()
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
    const message = { task, startTime: Date.now() }
    this.pendingMessages[id.toString()] = message

    // Send the message:
    this.transmitMessage(id, message)
  }

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------

  // Options:
  io: any
  queueSize: number
  timeout: number // Converted to ms
  callbacks: StratumCallbacks

  // Message queue:
  nextId: number
  pendingMessages: { [id: string]: PendingMessage }

  // Connection state:
  needsDisconnect: boolean
  lastKeepAlive: number
  partialMessage: string
  socket: net$Socket | void
  timer: TimeoutID
  error: Error
  sigkill: boolean

  /**
   * Called when the socket disconnects for any reason.
   */
  onSocketClose (hadError: boolean) {
    if ((hadError && !this.error) || !this.sigkill) {
      this.error = new Error('Unknown Server Error')
    }
    clearTimeout(this.timer)
    this.connected = false
    this.socket = void 0
    this.needsDisconnect = false
    this.sigkill = false
    for (const id of Object.keys(this.pendingMessages)) {
      const message = this.pendingMessages[id]
      try {
        message.task.onFail(this.error)
      } catch (e) {
        console.log(this.errStr(e))
      }
    }
    this.pendingMessages = {}
    try {
      this.callbacks.onClose(this.error)
    } catch (e) {
      console.log(this.errStr(e))
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
    this.lastKeepAlive = Date.now()
    this.partialMessage = ''

    try {
      this.callbacks.onOpen()
    } catch (e) {
      this.close(e)
    }

    // Launch pending messages:
    for (const id of Object.keys(this.pendingMessages)) {
      const message = this.pendingMessages[id]
      this.transmitMessage(Number(id), message)
    }

    this.setupTimer()
    this.wakeUp()
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
      const now = Date.now()
      const json = JSON.parse(messageJson)

      if (json.id) {
        // We have an ID, so it's a reply to a single request:
        const id: string = json.id.toString()
        const message = this.pendingMessages[id]
        if (!message) {
          throw new Error(`Bad Stratum id in ${messageJson}`)
        }
        delete this.pendingMessages[id]
        const { error } = json
        try {
          if (error) {
            const errorMessage = error.message
              ? error.message.split('\n')[0]
              : error.code
            throw new Error(errorMessage)
          }
          message.task.onDone(json.result, now - message.startTime)
        } catch (e) {
          message.task.onFail(e)
        }
      } else if (json.method === 'blockchain.headers.subscribe') {
        try {
          // TODO: Validate
          this.callbacks.onNotifyHeader(json.params[0])
        } catch (e) {
          console.log(this.errStr(e))
        }
      } else if (json.method === 'blockchain.scripthash.subscribe') {
        try {
          // TODO: Validate
          this.callbacks.onNotifyScriptHash(json.params[0], json.params[1])
        } catch (e) {
          console.log(this.errStr(e))
        }
      } else if (/subscribe$/.test(json.method)) {
        // It's some other kind of subscription.
      } else {
        throw new Error(`Bad Stratum reply ${messageJson}`)
      }
    } catch (e) {
      this.close(e)
    }
    this.wakeUp()
  }

  /**
   * Called when the timer expires.
   */
  onTimer () {
    const now = Date.now() - TIMER_SLACK

    if (this.lastKeepAlive + KEEP_ALIVE_MS < now) {
      this.submitTask(
        fetchVersion(
          (version: string) => {
            this.callbacks.onTimer(now)
          },
          (e: Error) => this.close(e)
        )
      )
    }

    for (const id of Object.keys(this.pendingMessages)) {
      const message = this.pendingMessages[id]
      if (message.startTime + this.timeout < now) {
        try {
          message.task.onFail(new Error('Timeout'))
        } catch (e) {
          console.log(this.errStr(e))
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
    if (e && !this.error) this.error = e
    if (this.connected && this.socket) this.disconnect()
    else this.needsDisconnect = true
  }

  disconnect () {
    clearTimeout(this.timer)
    this.sigkill = true
    this.connected = false
    if (this.socket) this.socket.destroy(this.error)
  }

  setupTimer () {
    // Find the next time something needs to happen:
    let nextWakeUp = this.lastKeepAlive + KEEP_ALIVE_MS

    for (const id of Object.keys(this.pendingMessages)) {
      const message = this.pendingMessages[id]
      const timeout = message.startTime + this.timeout
      if (timeout < nextWakeUp) nextWakeUp = timeout
    }

    const now = Date.now() - TIMER_SLACK
    const delay = nextWakeUp < now ? 0 : nextWakeUp - now
    this.timer = setTimeout(() => this.onTimer(), delay)
  }

  transmitMessage (id: number, pending: PendingMessage) {
    const now = Date.now()
    if (this.socket && this.connected && !this.needsDisconnect) {
      pending.startTime = now
      // If this is a keepAlive, record the time:
      if (pending.task.method === 'server.version') {
        this.lastKeepAlive = now
      }

      const message = {
        id,
        method: pending.task.method,
        params: pending.task.params
      }
      this.socket.write(JSON.stringify(message) + '\n')
    }
  }
}
