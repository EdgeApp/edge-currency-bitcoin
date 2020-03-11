// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as XPriv from '../../src/hd/xpriv.js'
import * as Path from '../../src/hd/path.js'
import { HARDENED } from '../../src/hd/common.js'
import * as XPub from '../../src/hd/xpub.js'
import fixtures from './fixtures/xpriv.json'

const { network } = fixtures

describe('Testing XPriv Key', function () {
  fixtures.fromSeed.forEach(test => {
    it(`XPriv from seed ${test[1]}`, function () {
      const childKey = XPriv.fromSeed(test[1], network)
      const xkey = XPriv.toString(childKey)
      assert.deepEqual(xkey, test[2])
    })
  })

  fixtures.string.forEach(test => {
    const base58Key = test[0]
    const privateKey = {
      privateKey: test[1],
      version: test[2],
      depth: test[3],
      parentFingerPrint: test[4],
      childNumber: test[5],
      chainCode: test[6]
    }

    it(`XPriv from string: ${test[0]}`, function () {
      const resultedXkey = XPriv.fromString(base58Key, network)
      assert.deepEqual(resultedXkey, privateKey)
    })

    it(`XPriv to string: ${test[1]}`, function () {
      const resultedBase58Key = XPriv.toString(privateKey, network)
      assert.equal(resultedBase58Key, base58Key)
    })
  })

  fixtures.toIndex.forEach(test => {
    it(`Deriving XPriv ${test[0]} for index ${test[2]}`, async function () {
      const privateKey = test[0]
      const chainCode = test[1]
      const index = test[2]
      const publicKey = test[6] || null
      const expectedChildKey = {
        privateKey: test[3],
        chainCode: test[4],
        childNumber: test[5]
      }
      const xKey = XPriv.fromXPriv({ privateKey, chainCode, publicKey })
      const childKey = await XPriv.toIndex(xKey, index)
      assert.deepEqual({
        privateKey: childKey.privateKey,
        chainCode: childKey.chainCode,
        childNumber: childKey.childNumber
      }, expectedChildKey)
    })
  })

  fixtures.toPath1.forEach(test => {
    it(`Deriving key ${test[0]} for bips ${test[2]}`, async function () {
      const xkey = test[0]
      const parentKey = XPriv.fromString(xkey, network)

      let account = 0
      let coinType = 0
      let bips = test[2]
      if (!bips) bips = [84]
      if (test[1]) {
        account = test[1][0]
        coinType = test[1][1]
      }
      let testIndex = 3

      const testPath = async (path) => {
        const hdKey = await XPriv.toPath(parentKey, path)
        const xprivkey = XPriv.toString(hdKey, network)
        const pubKey = await XPriv.toXPub(hdKey)
        const xpubkey = XPub.toString(pubKey, network)
        assert.equal(xprivkey, test[testIndex++], 'xpriv')
        assert.equal(xpubkey, test[testIndex++], 'xpub')
      }

      for (const purpose of bips) {
        if (purpose === 32) {
          await testPath(['m', `${account}`, 0].join('/'))
          testIndex -= 2
          await testPath([account, 0])
        } else {
          await testPath(['m', `${purpose}'`, `${coinType}'`, `${account}'`, 0].join('/'))
          await testPath(['m', `${purpose}'`, `${coinType}'`, `${account}'`, 1].join('/'))
          testIndex -= 4
          await testPath([purpose + HARDENED, coinType + HARDENED, account + HARDENED, 0])
          await testPath([purpose + HARDENED, coinType + HARDENED, account + HARDENED, 1])
        }
      }
    })
  })

  fixtures.toPath2.forEach(test => {
    it(`Deriving XPriv key from xkey ${test[0]} with path ${
      test[1]
    }`, async function () {
      const path = Path.fromString(test[1])
      const parentKey = XPriv.fromString(test[0])
      let testIndex = 2
      while (path.length) {
        const hdKey = await XPriv.toPath(parentKey, path)
        const xprivkey = XPriv.toString(hdKey, network)
        const publicKey = await XPriv.toXPub(hdKey, network)
        const xpubkey = XPub.toString(publicKey, network)
        assert.equal(xprivkey, test[testIndex][0], 'xpriv')
        assert.equal(xpubkey, test[testIndex][1], 'xpub')
        path.pop()
        testIndex++
      }
    })
  })
})
