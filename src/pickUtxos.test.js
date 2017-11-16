/**
 * Created by Paul Puey on 2017/11/09
 * @flow
 */

import { assert } from 'chai'
import { describe, it } from 'mocha'

import type { AddressCache, AddressObj } from '../src/engine/engine-state.js'
// import type { HeaderCache } from '../src/pluginState'
import { pickUtxos } from './pickUtxos.js'

// const headerCache: HeaderCache = {
//   height: 300000,
//   headers: { 200000: 1510735460 }
// }
//

const addressObj: AddressObj = {
  txids: ['txid1'],
  txidStratumHash: 'mystratumhash',

  utxos: [{ txid: 'txid1', index: 0, value: 100 }],
  utxoStratumHash: 'txid1',
  used: true,
  displayAddress: 'mydisplayaddress',
  path: 'somepath' // TODO: Define the contents of this member.
}

describe(`Pick UTXOs`, function () {
  it('Exact fit 1 utxo', function () {
    const addressCache: AddressCache = {
      address1: Object.assign({}, addressObj, {
        txids: ['txid1'],
        utxos: [{ txid: 'txid1', index: 0, value: 100 }]
      }),
      address2: Object.assign({}, addressObj, {
        txids: ['txid1', 'txid2', 'txid3'],
        utxos: [
          { txid: 'txid1', index: 1, value: 200 },
          { txid: 'txid2', index: 1, value: 300 },
          { txid: 'txid3', index: 1, value: 400 }
        ]
      }),
      address3: Object.assign({}, addressObj, {
        txids: ['txid1'],
        utxos: [{ txid: 'txid1', index: 2, value: 500 }]
      })
    }
    const control = [{ txid: 'txid3', index: 1, value: 400 }]
    const pickedUtxos = pickUtxos(addressCache, 400, false)
    assert.equal(JSON.stringify(pickedUtxos), JSON.stringify(control))
  })

  it('Exact fit 2 utxos', function () {
    const addressCache: AddressCache = {
      address1: Object.assign({}, addressObj, {
        txids: ['txid1'],
        utxos: [{ txid: 'txid1', index: 0, value: 100 }]
      }),
      address2: Object.assign({}, addressObj, {
        txids: ['txid1', 'txid2', 'txid3'],
        utxos: [
          { txid: 'txid1', index: 1, value: 200 },
          { txid: 'txid2', index: 1, value: 300 },
          { txid: 'txid3', index: 1, value: 400 }
        ]
      }),
      address3: Object.assign({}, addressObj, {
        txids: ['txid1'],
        utxos: [{ txid: 'txid1', index: 2, value: 600 }]
      })
    }
    const control = [
      { txid: 'txid1', index: 2, value: 600 },
      { txid: 'txid1', index: 0, value: 100 }
    ]
    const pickedUtxos = pickUtxos(addressCache, 700, false)
    assert.equal(JSON.stringify(pickedUtxos), JSON.stringify(control))
  })

  it('Exact fit 3 utxos', function () {
    const addressCache: AddressCache = {
      address1: Object.assign({}, addressObj, {
        txids: ['txid1'],
        utxos: [{ txid: 'txid1', index: 0, value: 100 }]
      }),
      address2: Object.assign({}, addressObj, {
        txids: ['txid1', 'txid2', 'txid3'],
        utxos: [
          { txid: 'txid1', index: 1, value: 200 },
          { txid: 'txid2', index: 1, value: 300 },
          { txid: 'txid3', index: 1, value: 400 }
        ]
      }),
      address3: Object.assign({}, addressObj, {
        txids: ['txid1'],
        utxos: [{ txid: 'txid1', index: 2, value: 600 }]
      })
    }
    const control = [
      { txid: 'txid1', index: 2, value: 600 },
      { txid: 'txid3', index: 1, value: 400 },
      { txid: 'txid2', index: 1, value: 300 }
    ]
    const pickedUtxos = pickUtxos(addressCache, 1300, false)
    assert.equal(JSON.stringify(pickedUtxos), JSON.stringify(control))
  })
  it('Non-exact fit 1 utxo', function () {
    const addressCache: AddressCache = {
      address1: Object.assign({}, addressObj, {
        txids: ['txid1'],
        utxos: [{ txid: 'txid1', index: 0, value: 100 }]
      }),
      address2: Object.assign({}, addressObj, {
        txids: ['txid1', 'txid2', 'txid3'],
        utxos: [
          { txid: 'txid1', index: 1, value: 200 },
          { txid: 'txid2', index: 1, value: 300 },
          { txid: 'txid3', index: 1, value: 400 }
        ]
      }),
      address3: Object.assign({}, addressObj, {
        txids: ['txid1'],
        utxos: [{ txid: 'txid1', index: 2, value: 600 }]
      })
    }
    const control = [{ txid: 'txid1', index: 2, value: 600 }]
    const pickedUtxos = pickUtxos(addressCache, 190, false)
    assert.equal(JSON.stringify(pickedUtxos), JSON.stringify(control))
  })

  it('Non-exact fit 2 utxo', function () {
    const addressCache: AddressCache = {
      address1: Object.assign({}, addressObj, {
        txids: ['txid1'],
        utxos: [{ txid: 'txid1', index: 0, value: 100 }]
      }),
      address2: Object.assign({}, addressObj, {
        txids: ['txid1', 'txid2', 'txid3'],
        utxos: [
          { txid: 'txid1', index: 1, value: 200 },
          { txid: 'txid2', index: 1, value: 300 },
          { txid: 'txid3', index: 1, value: 400 }
        ]
      }),
      address3: Object.assign({}, addressObj, {
        txids: ['txid1'],
        utxos: [{ txid: 'txid1', index: 2, value: 600 }]
      })
    }
    const control = [
      { txid: 'txid1', index: 2, value: 600 },
      { txid: 'txid3', index: 1, value: 400 }
    ]
    const pickedUtxos = pickUtxos(addressCache, 950, false)
    assert.equal(JSON.stringify(pickedUtxos), JSON.stringify(control))
  })
})
