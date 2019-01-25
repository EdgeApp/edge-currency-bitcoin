// @flow
// eslint-disable-next-line no-unused-vars
import * as Factories from '../../../../src/index.js'
import * as ExtendedKey from '../../../../src/coinUtils/bip32/extendedKey.js'
import { describe, it } from 'mocha'
import { assert } from 'chai'
import fixtures from './fixtures.json'
for (const network in fixtures) {
  describe(`Testing Extended Key functions with network: ${network}`, function () {
    const tests = fixtures[network]
    tests.forEach(test => {
      const base58Key = test[0]
      const xkey = {
        version: test[2],
        depth: test[3],
        parentFingerPrint: test[4],
        childIndex: test[5],
        chainCode: Buffer.from(test[6], 'hex')
      }

      if (test[1].length === 64) xkey.privateKey = Buffer.from(test[1], 'hex')
      if (test[1].length === 66) xkey.publicKey = Buffer.from(test[1], 'hex')

      it(`Extended key from string: ${test[0]}`, async function () {
        const resultedXkey = await ExtendedKey.fromString(base58Key, network)
        assert.deepEqual(resultedXkey, xkey)
      })

      it(`Extended key to string: ${test[1]}`, async function () {
        if (!xkey.publicKey) xkey.publicKey = Buffer.from(`02${test[1]}`, 'hex')
        const resultedBase58Key = await ExtendedKey.toString(xkey, network)
        assert.equal(resultedBase58Key, base58Key)
      })
    })
  })
}
