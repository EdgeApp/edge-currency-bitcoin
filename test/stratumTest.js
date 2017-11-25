// @flow
import { expect } from 'chai'
import { describe, it } from 'mocha'
import net from 'net'
import tls from 'tls'

import type { StratumCallbacks } from '../src/stratum/stratum-connection.js'
import { StratumConnection } from '../src/stratum/stratum-connection.js'
import {
  fetchVersion,
  subscribeHeight,
  fetchBlockHeader,
  // subscribeScriptHash,
  // fetchScriptHashHistory,
  // type TxHistoryType,
  type FetchBlockHeaderType
} from '../src/stratum/stratum-messages.js'

const ELECTRUM_SERVER = 'electrum://electrum.villocq.com:50001'
const io = {
  Socket: net.Socket,
  TLSSocket: tls.TLSSocket
}

describe('StratumConnection', function () {
  it('fetchVersion', function (done) {
    const task = fetchVersion(
      data => {
        const ver = parseFloat(data)
        expect(ver).to.be.at.least(1.1)
        connection.close()
        done()
      },
      () => {
        throw new Error('should never happen')
      }
    )
    let taskQueued = false
    const callbacks: StratumCallbacks = {
      onOpen (uri: string) {},
      onClose (uri: string) {},
      onQueueSpace (uri: string) {
        if (taskQueued) {
          return void 0
        }
        taskQueued = true
        return task
      }
    }
    const connection = new StratumConnection(ELECTRUM_SERVER, { callbacks, io })
    connection.open()
  })
  it('subscribeHeight', function (done) {
    const task = subscribeHeight(
      data => {
        expect(data).to.be.at.least(400000)
        connection.close()
        done()
      },
      () => {
        throw new Error('should never happen')
      }
    )
    let taskQueued = false
    const callbacks: StratumCallbacks = {
      onOpen (uri: string) {},
      onClose (uri: string) {},
      onQueueSpace (uri: string) {
        if (taskQueued) {
          return void 0
        }
        taskQueued = true
        return task
      }
    }
    const connection = new StratumConnection(ELECTRUM_SERVER, { callbacks, io })
    connection.open()
  })
  it('fetchBlockHeader', function (done) {
    const task = fetchBlockHeader(
      400000,
      (data: FetchBlockHeaderType) => {
        expect(data.block_height).to.equal(400000)
        expect(data.prev_block_hash).to.equal('0000000000000000030034b661aed920a9bdf6bbfa6d2e7a021f78481882fa39')
        expect(data.timestamp).to.equal(1456417484)
        connection.close()
        done()
      },
      () => {
        throw new Error('should never happen')
      }
    )
    let taskQueued = false
    const callbacks: StratumCallbacks = {
      onOpen (uri: string) {},
      onClose (uri: string) {},
      onQueueSpace (uri: string) {
        if (taskQueued) {
          return void 0
        }
        taskQueued = true
        return task
      }
    }
    const connection = new StratumConnection(ELECTRUM_SERVER, { callbacks, io })
    connection.open()
  })
  // it('subscribeScriptHash', function (done) {
  //   const task = subscribeScriptHash(
  //     '187b07664e7f1c6a26911530652b24376c1a8d1ae734d7c9fa925e7f117b077d',
  //     (data: string) => {
  //       expect(data.length).to.be.gte(0)
  //       connection.close()
  //       done()
  //     },
  //     () => {
  //       throw new Error('should never happen')
  //     }
  //   )
  //   let taskQueued = false
  //   const callbacks: StratumCallbacks = {
  //     onOpen (uri: string) {},
  //     onClose (uri: string) {},
  //     onQueueSpace (uri: string) {
  //       if (taskQueued) {
  //         return void 0
  //       }
  //       taskQueued = true
  //       return task
  //     }
  //   }
  //   const connection = new StratumConnection(ELECTRUM_SERVER, { callbacks, io })
  //   connection.open()
  // })
  // it('fetchScriptHashHistory', function (done) {
  //   const task = fetchScriptHashHistory(
  //     '187b07664e7f1c6a26911530652b24376c1a8d1ae734d7c9fa925e7f117b077d',
  //     (data: Array<TxHistoryType>) => {
  //       expect(data.length).to.be.gte(0)
  //       connection.close()
  //       done()
  //     },
  //     () => {
  //       throw new Error('should never happen')
  //     }
  //   )
  //   let taskQueued = false
  //   const callbacks: StratumCallbacks = {
  //     onOpen (uri: string) {},
  //     onClose (uri: string) {},
  //     onQueueSpace (uri: string) {
  //       if (taskQueued) {
  //         return void 0
  //       }
  //       taskQueued = true
  //       return task
  //     }
  //   }
  //   const connection = new StratumConnection(ELECTRUM_SERVER, { callbacks, io })
  //   connection.open()
  // })
})
