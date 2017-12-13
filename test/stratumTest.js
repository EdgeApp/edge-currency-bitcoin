// @flow
import { expect, assert } from 'chai'
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
  subscribeScriptHash,
  fetchScriptHashHistory,
  fetchScriptHashUtxo,
  type StratumHistoryRow,
  type StratumBlockHeader
} from '../src/stratum/stratum-messages.js'
import type { StratumUtxo } from '../src/stratum/stratum-messages'

// const ELECTRUM_SERVER = 'electrum://electrum.villocq.com:50001'
const ELECTRUM_SERVER = 'electrum://electrum-bu-az-wusa2.airbitz.co:50001'
const io = {
  Socket: net.Socket,
  TLSSocket: tls.TLSSocket
}

function fetchVersionHelper (connection, done) {
  return fetchVersion(
    data => {
      if (connection) {
        connection.close()
      }
      const ver = parseFloat(data)
      expect(ver).to.be.at.least(1.1)
      if (done) {
        done()
      }
    },
    () => {
      throw new Error('should never happen')
    }
  )
}

describe('StratumConnection', function () {
  it('fetchVersion', function (done) {
    let taskQueued = false
    const callbacks: StratumCallbacks = {
      onOpen (uri: string) {},
      onClose (uri: string) {},
      onQueueSpace (uri: string) {
        if (taskQueued) {
          return void 0
        }
        taskQueued = true
        return fetchVersionHelper(connection, done)
      }
    }
    const connection = new StratumConnection(ELECTRUM_SERVER, { callbacks, io })
    connection.open()
  })
  it('subscribeHeight', function (done) {
    const task = subscribeHeight(
      data => {
        connection.close()
        expect(data).to.be.at.least(400000)
        done()
      },
      () => {
        connection.close()
        throw new Error('subscribeHeight: should never happen')
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
      (data: StratumBlockHeader) => {
        connection.close()
        expect(data.block_height).to.equal(400000)
        expect(data.prev_block_hash).to.equal(
          '0000000000000000030034b661aed920a9bdf6bbfa6d2e7a021f78481882fa39'
        )
        expect(data.timestamp).to.equal(1456417484)
        done()
      },
      () => {
        connection.close()
        throw new Error('fetchBlockHeader: should never happen')
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
        connection.close()
        expect(data).to.equal(
          '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0704ffff001d0104ffffffff0100f2052a0100000043410496b538e853519c726a2c91e61ec11600ae1390813a627c66fb8be7947be63c52da7589379515d4e0a604f8141781e62294721166bf621e73a82cbf2342c858eeac00000000'
        )
        done()
      },
      () => {
        connection.close()
        throw new Error('fetchTransaction: should never happen')
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
  it('subscribeScriptHash', function (done) {
    const task = subscribeScriptHash(
      '187b07664e7f1c6a26911530652b24376c1a8d1ae734d7c9fa925e7f117b077d',
      (data: string | null) => {
        connection.close()
        assert.equal(
          data,
          'a1e0a04e5c66342aca0171a398ff131f9cb51edb30c1e68cf67dd28bb3615b57'
        )
        done()
      },
      () => {
        connection.close()
        throw new Error('subscribeScriptHash: should never happen')
      }
    )
    let versionTaskQueued = false
    let taskQueued = false
    const callbacks: StratumCallbacks = {
      onOpen (uri: string) {},
      onClose (uri: string) {},
      onQueueSpace (uri: string) {
        if (!versionTaskQueued) {
          versionTaskQueued = true
          return fetchVersionHelper(null, null)
        }
        if (!taskQueued) {
          taskQueued = true
          return task
        }
        return void 0
      }
    }
    const connection = new StratumConnection(ELECTRUM_SERVER, { callbacks, io })
    connection.open()
  })
  it('fetchScriptHashHistory', function (done) {
    const task = fetchScriptHashHistory(
      '187b07664e7f1c6a26911530652b24376c1a8d1ae734d7c9fa925e7f117b077d',
      (data: Array<StratumHistoryRow>) => {
        connection.close()
        assert.equal(data.length > 0, true)
        assert.equal(
          data[0].tx_hash,
          '7d73beab722e34648c586a1657450e5b7ee5be0456e1579c60a69f1da19a561c'
        )
        assert.equal(data[0].height, 496162)
        done()
      },
      () => {
        connection.close()
        throw new Error('fetchScriptHashHistory: should never happen')
      }
    )
    let versionTaskQueued = false
    let taskQueued = false
    const callbacks: StratumCallbacks = {
      onOpen (uri: string) {},
      onClose (uri: string) {},
      onQueueSpace (uri: string) {
        if (!versionTaskQueued) {
          versionTaskQueued = true
          return fetchVersionHelper(null, null)
        }
        if (!taskQueued) {
          taskQueued = true
          return task
        }
        return void 0
      }
    }
    const connection = new StratumConnection(ELECTRUM_SERVER, { callbacks, io })
    connection.open()
  })
  it('fetchScriptHashUtxo', function (done) {
    const task = fetchScriptHashUtxo(
      '187b07664e7f1c6a26911530652b24376c1a8d1ae734d7c9fa925e7f117b077d',
      (data: Array<StratumUtxo>) => {
        connection.close()
        assert.equal(data.length > 0, true)
        assert.equal(
          data[0].tx_hash,
          '7d73beab722e34648c586a1657450e5b7ee5be0456e1579c60a69f1da19a561c'
        )
        assert.equal(data[0].height, 496162)
        assert.equal(data[0].tx_pos, 0)
        assert.equal(data[0].value, 10874)
        done()
      },
      () => {
        throw new Error('fetchScriptHashUtxo: should never happen')
      }
    )
    let versionTaskQueued = false
    let taskQueued = false
    const callbacks: StratumCallbacks = {
      onOpen (uri: string) {},
      onClose (uri: string) {},
      onQueueSpace (uri: string) {
        if (!versionTaskQueued) {
          versionTaskQueued = true
          return fetchVersionHelper(null, null)
        }
        if (!taskQueued) {
          taskQueued = true
          return task
        }
        return void 0
      }
    }
    const connection = new StratumConnection(ELECTRUM_SERVER, { callbacks, io })
    connection.open()
  })
})
