// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'

import * as ExtendedKey from '../../../../src/utils/nidavellir/bip32/extendedKey.js'
import fixtures from './fixtures.json'

const XKeyFixtures = fixtures.extendedKey
const network = 'main'

describe(`Testing Extended Key functions`, function() {
  XKeyFixtures.string.forEach(test => {
    const base58Key = test[0]
    let xkey = {
      version: test[2],
      depth: test[3],
      parentFingerPrint: test[4],
      childIndex: test[5],
      chainCode: test[6]
    }

    if (test[1].length === 64) xkey = { ...xkey, privateKey: test[1] }
    if (test[1].length === 66) xkey = { ...xkey, publicKey: test[1] }

    it(`Extended key from string: ${test[0]}`, function() {
      const resultedXkey = ExtendedKey.fromString(base58Key, network)
      assert.deepEqual(resultedXkey, xkey)
    })

    it(`Extended key to string: ${test[1]}`, function() {
      if (!xkey.publicKey) xkey = { ...xkey, publicKey: `02${test[1]}` }
      const resultedBase58Key = ExtendedKey.toString(xkey, network)
      assert.equal(resultedBase58Key, base58Key)
    })
  })
})
