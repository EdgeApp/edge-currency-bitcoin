// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'

import * as HDKey from '../../src/bip44/hdKey.js'
import { fromBips, fromSettings } from '../../src/bip44/paths.js'
import fixtures from './fixtures.json'

const HDKeyFixtures = fixtures.hdKey
const network = 'main'

describe('Testing HD Key', function () {
  HDKeyFixtures.fromSeed.forEach(test => {
    it(`Creating HD key from phrase ${test[0]}`, async function () {
      const childKey = await HDKey.fromSeed(test[1])
      const xkey = HDKey.toString(childKey)
      assert.deepEqual(xkey, test[2])
    })
  })
  HDKeyFixtures.fromString.forEach(test => {
    it(`Creating HD key from xkey ${test[0]} with path ${test[1]}`, function () {
      const opts = {}
      if (test[1]) opts.path = test[1].split('/')
      const hdKey = HDKey.fromString(test[0], opts)
      assert.equal(hdKey.hardened, test[2])
      assert.equal(hdKey.path.join('/'), test[3])
    })
  })
  HDKeyFixtures.fromStringErrors.forEach(test => {
    it(`Error on Creating HD key with error type ${test[2]}`, function () {
      try {
        HDKey.fromString(test[0], { path: test[1].split('/') })
      } catch (e) {
        assert.equal(e.message, test[2])
      }
    })
  })
  HDKeyFixtures.fromParent.forEach(test => {
    it(`Deriving HD key from xkey ${test[0]} with path ${
      test[1]
    }`, async function () {
      const path = test[1].split('/')
      const parentKey = HDKey.fromString(test[0])
      let hdKey = await HDKey.fromParent(parentKey, { path })
      path.shift()
      let testIndex = 2
      while (path.length) {
        const index = path.shift()
        hdKey = hdKey.children[index]
        const xprivkey = HDKey.toString(hdKey)
        const xpubkey = HDKey.toString(hdKey, network, true)
        assert.equal(xprivkey, test[testIndex][0], 'xpriv')
        assert.equal(xpubkey, test[testIndex][1], 'xpub')
        testIndex++
      }
    })
  })
  HDKeyFixtures.fromHDSettings.forEach(test => {
    it(`Deriving HD key ${test[0]} from HD Settings ${
      test[3]
    }`, async function () {
      const parentKey = HDKey.fromString(test[0])

      let pathParams
      if (test[1]) {
        pathParams = { account: test[1][0], coinType: test[1][1] }
      }

      const hdSettings = fromBips(test[2])
      const hdPaths = fromSettings(hdSettings, pathParams)
      const hdKey = await HDKey.fromHDPaths(parentKey, hdPaths, network)
      let testIndex = 3
      for (const hdPath of hdPaths) {
        const key = HDKey.getHDKey(hdKey, hdPath.path)
        if (!key) throw new Error('No Key')
        const xprivkey = HDKey.toString(key)
        const xpubkey = HDKey.toString(key, network, true)
        assert.equal(xprivkey, test[testIndex++], 'xpriv')
        assert.equal(xpubkey, test[testIndex++], 'xpub')
      }
    })
  })
})
