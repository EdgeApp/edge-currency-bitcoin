// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'

import * as XKey from '../../src/hd/xkey.js'
import * as Path from '../../src/hd/path.js'
import { HARDENED } from '../../src/hd/common.js'
import privateFixures from './fixtures/xpriv.json'
import publicFixures from './fixtures/xpub.json'

let { network } = privateFixures

describe('Testing XKey Private Key', function () {
  privateFixures.fromSeed.forEach(test => {
    it(`Extended key from seed ${test[1]}`, function () {
      const childKey = XKey.fromSeed(test[1], network)
      const xkey = XKey.toString(childKey)
      assert.deepEqual(xkey, test[2])
    })
  })

  privateFixures.string.forEach(test => {
    const base58Key = test[0]
    const privateKey = {
      privateKey: test[1],
      version: test[2],
      depth: test[3],
      parentFingerPrint: test[4],
      childNumber: test[5],
      chainCode: test[6]
    }

    it(`XKey key from string: ${test[0]}`, function () {
      const resultedXkey = XKey.fromString(base58Key, network)
      assert.deepEqual(resultedXkey, privateKey)
    })

    it(`XKey key to string: ${test[1]}`, function () {
      const resultedBase58Key = XKey.toString(privateKey, network)
      assert.equal(resultedBase58Key, base58Key)
    })
  })

  privateFixures.toIndex.forEach(test => {
    it(`Deriving key ${test[0]} for index ${test[2]}`, async function () {
      const privateKey = test[0]
      const chainCode = test[1]
      const index = test[2]
      const publicKey = test[6]
      const expectedChildKey = {
        privateKey: test[3],
        chainCode: test[4],
        childNumber: test[5]
      }
      // $FlowFixMe
      const xKey = XKey.fromXKey({ privateKey, chainCode, publicKey }, network)
      // $FlowFixMe
      const childKey = await XKey.toIndex(xKey, index)
      assert.deepEqual({
        privateKey: childKey.privateKey,
        chainCode: childKey.chainCode,
        childNumber: childKey.childNumber
      }, expectedChildKey)
    })
  })

  privateFixures.toPath1.forEach(test => {
    it(`Deriving XKey key ${test[0]} from XKey Settings ${
      test[3]
    }`, async function () {
      const xkey = test[0]
      const parentKey = XKey.fromString(xkey, network)

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
        const hdKey = await XKey.toPath(parentKey, path)
        const xprivkey = XKey.toString(hdKey, network)
        const pubKey = await XKey.toXPub(hdKey, network)
        const xpubkey = XKey.toString(pubKey, network)
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

  privateFixures.toPath2.forEach(test => {
    it(`Deriving XKey key from xkey ${test[0]} with path ${
      test[1]
    }`, async function () {
      const path = Path.fromString(test[1])
      const parentKey = XKey.fromString(test[0])
      let testIndex = 2
      while (path.length) {
        const hdKey = await XKey.toPath(parentKey, path)
        const xprivkey = XKey.toString(hdKey, network)
        const publicKey = await XKey.toXPub(hdKey, network)
        const xpubkey = XKey.toString(publicKey, network)
        assert.equal(xprivkey, test[testIndex][0], 'xpriv')
        assert.equal(xpubkey, test[testIndex][1], 'xpub')
        path.pop()
        testIndex++
      }
    })
  })
})

network = publicFixures.network

describe('Testing XKey Public Key', function () {
  publicFixures.string.forEach(test => {
    const base58Key = test[0]
    const publicKey = {
      publicKey: test[1],
      version: test[2],
      depth: test[3],
      parentFingerPrint: test[4],
      childNumber: test[5],
      chainCode: test[6]
    }

    it(`XKey key from string: ${test[0]}`, function () {
      const resultedXkey = XKey.fromString(base58Key, network)
      assert.deepEqual(resultedXkey, publicKey)
    })

    it(`XKey key to string: ${test[1]}`, function () {
      const resultedBase58Key = XKey.toString(publicKey, network)
      assert.equal(resultedBase58Key, base58Key)
    })
  })

  publicFixures.toIndex.forEach(test => {
    it(`Deriving key ${test[0]} for index ${test[2]}`, async function () {
      const publicKey = test[0]
      const chainCode = test[1]
      const index = test[2]
      const expectedChildKey = {
        publicKey: test[3],
        chainCode: test[4],
        childNumber: test[5]
      }
      const xKey = XKey.fromXKey({ publicKey, chainCode })
      const childKey = await XKey.toIndex(xKey, index)
      assert.deepEqual({
        publicKey: childKey.publicKey,
        chainCode: childKey.chainCode,
        childNumber: childKey.childNumber
      }, expectedChildKey)
    })
  })
})
