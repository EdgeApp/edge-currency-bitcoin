// @flow

/**
 * This object holds the plugin-wide per-currency caches.
 * Engine plugins are responsible for keeping it up to date.
 */
export class PluginState {
  // On-disk header information:
  headerCache: {
    height: number,
    headers: {
      [height: number]: {
        timestamp: number
      }
    }
  }

  // True if somebody is currently fetching a header:
  headerStates: {
    [height: number]: { fetching: boolean }
  }

  // On-disk server information:
  serverCache: {
    [uri: string]: {
      score: number,
      latency: number // ms
    }
  }

  constructor () {
    this.serverCache = {}
    this.headerCache = {
      height: 0,
      headers: {}
    }
  }
}
