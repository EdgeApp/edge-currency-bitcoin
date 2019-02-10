// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'

import { keyPairFromWIF } from '../../src/commons/keyPair.js'
import fixtures from './fixtures.json'

const KeyPairFixtures = fixtures.keyPair
const network = 'main'

describe('Testing HD Key', function () {
  KeyPairFixtures.keyPairFromWIF.forEach(test => {
    it(`Creating Key Pair from WIF ${test[0]}`, async function () {
      const keyPair = await keyPairFromWIF(test[0], network)
      assert.equal(keyPair.publicKey, test[1])
    })
  })
})
