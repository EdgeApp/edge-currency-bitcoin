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
  fetchTransaction,
  // subscribeScriptHash,
  // fetchScriptHashHistory,
  // fetchScripthashUtxo,
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
  it('fetchTransaction', function (done) {
    const task = fetchTransaction(
      '0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098',
      (data: string) => {
        expect(data).to.equal('01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0704ffff001d0104ffffffff0100f2052a0100000043410496b538e853519c726a2c91e61ec11600ae1390813a627c66fb8be7947be63c52da7589379515d4e0a604f8141781e62294721166bf621e73a82cbf2342c858eeac00000000')
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
  // it('fetchScripthashUtxo', function (done) {
  //   const task = fetchScripthashUtxo(
  //     '187b07664e7f1c6a26911530652b24376c1a8d1ae734d7c9fa925e7f117b077d',
  //     (data: Array<fetchScripthashUtxo>) => {
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
