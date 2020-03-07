// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'

import * as HDKey from '../../../../src/utils/nidavellir/bip32/hdKey.js'
import { createPaths } from '../../../../src/utils/nidavellir/bip44/paths.js'
import fixtures from './fixtures.json'

const network = 'main'

describe('Testing Bip44 HD Key path derivation', function () {
  fixtures.createPaths.forEach(test => {
    it(`Deriving HD key ${test[0]} from HD Settings ${
      test[3]
    }`, async function () {
      const parentKey = HDKey.fromString(test[0])

      let account = 0
      let coinType = 0
      if (test[1]) {
        account = test[1][0]
        coinType = test[1][1]
      }

      const hdPaths = createPaths(test[2], coinType, account, 'bitcoin')
      const hdKey = await HDKey.fromPaths(parentKey, hdPaths, network)
      let testIndex = 3
      for (const hdPath of hdPaths) {
        const key = HDKey.getKey(hdKey, hdPath.path)
        if (!key) throw new Error('No Key')
        const xprivkey = HDKey.toString(key)
        const xpubkey = HDKey.toString(key, network, true)
        assert.equal(xprivkey, test[testIndex++], 'xpriv')
        assert.equal(xpubkey, test[testIndex++], 'xpub')
      }
    })
  })
})
