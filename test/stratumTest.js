// @flow
import { expect } from 'chai'
import { describe, it } from 'mocha'
import net from 'net'
import tls from 'tls'

import type { StratumCallbacks } from '../src/stratum/stratum-connection.js'
import { StratumConnection } from '../src/stratum/stratum-connection.js'
import { fetchVersion, subscribeHeight } from '../src/stratum/stratum-messages.js'

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
})
