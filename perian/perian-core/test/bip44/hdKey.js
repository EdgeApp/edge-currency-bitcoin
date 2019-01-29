// @flow
import * as HDKey from '../../src/bip44/hdKey.js'
import { describe, it } from 'mocha'
import { assert } from 'chai'
import fixtures from './fixtures.json'

const HDKeyFixtures = fixtures.hdKey

describe('Testing HD Key', function () {
  HDKeyFixtures.fromSeed.forEach(test => {
    it(`Creating HD key from phrase ${test[0]}`, async function () {
      const childKey = await HDKey.fromSeed(test[1])
      const xkey = await HDKey.toString(childKey)
      assert.deepEqual(xkey, test[2])
    })
  })
  HDKeyFixtures.fromString.forEach(test => {
    it(`Creating HD key from xkey ${test[0]} with path ${test[1]}`, async function () {
      const opts = {}
      if (test[1]) opts.path = test[1].split('/')
      const hdKey = await HDKey.fromString(test[0], opts)
      assert.equal(hdKey.hardened, test[2])
      assert.equal(hdKey.path.join('/'), test[3])
    })
  })
  HDKeyFixtures.fromStringErrors.forEach(test => {
    it(`Error on Creating HD key with error type ${test[2]}`, async function () {
      try {
        await HDKey.fromString(test[0], { path: test[1].split('/') })
      } catch (e) {
        assert.equal(e.message, test[2])
      }
    })
  })
  HDKeyFixtures.fromParent.forEach(test => {
    it(`Deriving HD key from xkey ${test[0]} with path ${test[1]}`, async function () {
      const parentKey = await HDKey.fromString(test[0])
      const hdKey = await HDKey.fromParent(parentKey, { path: test[1].split('/') })
      console.log('hdKey', hdKey)
    })
  })
})
