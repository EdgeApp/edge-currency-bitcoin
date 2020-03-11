// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'

import * as XPub from '../../src/hd/xpub.js'
import fixtures from './fixtures/xpub.json'

const { network } = fixtures

describe('Testing XPub', function () {
  fixtures.string.forEach(test => {
    const base58Key = test[0]
    const publicKey = {
      publicKey: test[1],
      version: test[2],
      depth: test[3],
      parentFingerPrint: test[4],
      childNumber: test[5],
      chainCode: test[6]
    }

    it(`XPub from string: ${test[0]}`, function () {
      const resultedXkey = XPub.fromString(base58Key, network)
      assert.deepEqual(resultedXkey, publicKey)
    })

    it(`XPub to string: ${test[1]}`, function () {
      const resultedBase58Key = XPub.toString(publicKey, network)
      assert.equal(resultedBase58Key, base58Key)
    })
  })

  fixtures.toIndex.forEach(test => {
    it(`Deriving XPub ${test[0]} for index ${test[2]}`, async function () {
      const publicKey = test[0]
      const chainCode = test[1]
      const index = test[2]
      const expectedChildKey = {
        publicKey: test[3],
        chainCode: test[4],
        childNumber: test[5]
      }
      const xKey = XPub.fromXPub({ publicKey, chainCode })
      const childKey = await XPub.toIndex(xKey, index)
      assert.deepEqual({
        publicKey: childKey.publicKey,
        chainCode: childKey.chainCode,
        childNumber: childKey.childNumber
      }, expectedChildKey)
    })
  })
})
