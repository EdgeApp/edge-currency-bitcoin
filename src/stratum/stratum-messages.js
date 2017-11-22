// @flow
import type { OnFailHandler, StratumTask } from './stratum-connection.js'

/**
 * Creates a server version query message.
 */
export function fetchVersion (
  onDone: (version: string) => void,
  onFail: OnFailHandler
) {
  return {
    method: 'server.version',
    params: ['1.1', '1.1'],
    onDone (reply: any) {
      if (typeof reply !== 'string') {
        throw new Error(`Bad Stratum version reply ${reply}`)
        // TODO: Actually check the server version
      }
      onDone(reply)
    },
    onFail
  }
}

/**
 * Creates a height subscription message.
 * @param {*} onDone Called for every height update.
 * @param {*} onFail Called if the subscription fails.
 */
export function subscribeHeight (
  onDone: (height: number) => void,
  onFail: OnFailHandler
): StratumTask {
  return {
    method: 'blockchain.numblocks.subscribe',
    params: [],
    onDone (reply: any) {
      if (typeof reply !== 'number') {
        throw new Error(`Bad Stratum height reply ${reply}`)
      }
      onDone(reply)
    },
    onFail
  }
}
