// @flow

export interface StratumTask {}

export interface StratumCallbacks {
  +onOpen: (uri: string) => void;
  +onClose: (uri: string, error?: Error) => void;
  +onQueueSpace: (uri: string) => StratumTask | void;
}

export interface StratumOptions {
  callbacks: StratumCallbacks;
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

  constructor (uri: string, options: StratumOptions) {
    const { callbacks = {}, queueSize = 10, timeout = 30 } = options
    const { onOpen = nop, onClose = nop, onQueueSpace = nop } = callbacks

    this.uri = uri
    this.onOpen = onOpen
    this.onClose = onClose
    this.onQueueSpace = onQueueSpace
    this.queueSize = queueSize
    this.timeout = timeout
  }

  /**
   * Activates the underlying TCP connection.
   */
  open () {}

  /**
   * Shuts down the underlying TCP connection.
   */
  close () {}

  /**
   * If there is space in the queue, re-triggers the `onQueueSpace` callback.
   */
  wakeup () {}

  /**
   * Forcefully sends a task to the Stratum server,
   * ignoring the queue checks. This should *only* be used for spends.
   */
  submitTask (task: StratumTask) {}

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------

  // Options:
  queueSize: number
  timeout: number
  onOpen: (uri: string) => void
  onClose: (uri: string, error?: Error) => void
  onQueueSpace: (uri: string) => StratumTask | void
}
