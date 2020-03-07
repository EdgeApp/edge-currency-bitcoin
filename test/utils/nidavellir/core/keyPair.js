// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'

import { fromWif } from '../../../../src/utils/nidavellir/core/keyPair.js'
import fixtures from './fixtures.json'

const KeyPairFixtures = fixtures.keyPair
const network = 'main'

describe('Testing HD Key', function() {
  KeyPairFixtures.fromWif.forEach(test => {
    it(`Creating Key Pair from WIF ${test[0]}`, async function() {
      const keyPair = await fromWif(test[0], network)
      assert.equal(keyPair.publicKey, test[1])
    })
  })
})
