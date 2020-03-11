// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'

import { fromWIF, toPublic, toWIF } from '../../src/core/privateKey.js'

import keys from './fixtures.json'

const network = 'main'

describe('Testing HD Key', function () {
  keys.forEach(test => {
    it(`Creating Private Key from WIF ${test[0]}`, function () {
      const wif = test[0]
      const { privateKey, compress } = fromWIF(wif, network)
      assert.equal(compress, test[1])
      assert.equal(privateKey, test[2])
    })

    it(`Creating Public Key from Private Key ${test[1]}`, async function () {
      const compress = test[1]
      const privateKey = test[2]
      const publicKey = await toPublic(privateKey, compress)
      assert.equal(publicKey, test[3])
    })

    it(`Creating WIF from from Private Key ${test[1]}`, function () {
      const compress = test[1]
      const privateKey = test[2]
      const wif = toWIF(privateKey, network, compress)
      assert.equal(wif, test[0])
    })
  })
})
