// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'

import { base } from '../../src/utils/base.js'
import { sha512Hmac } from '../../src/utils/hash.js'
import fixtures from './fixtures/base.json'

const data =
  '00ab0063a7ea84d7c5f4a9ad8690c69b80a2d650343fbc9266b2d73c7b26bb2cc780000020'
const key = '485efe44bc445946b58ba03e8da75d5cf44fc9196eaa88204667629c4e04c38d'
const res =
  '405fcc33d3f409f16571e19bd27053cd1d05e74df6eba0dc93c4c0a91599052429203b410e284513e14f67287843f91875bf69986f9cebf7037e79b0b13bbdbc'

const hash = sha512Hmac(key, data)
assert.equal(hash, res)

for (const fixture in fixtures) {
  describe(`Testing base ${fixture}`, function () {
    const fixtureBase = base[fixture].check

    fixtures[fixture].valid.forEach(({ string, payload }) => {
      it(`Decode valid string: ${string}`, async function () {
        const resultedPaylod = fixtureBase.decode(string)
        assert.equal(resultedPaylod, payload)
      })
      it(`Encode valid payload: ${payload}`, async function () {
        const resultedString = fixtureBase.encode(payload)
        assert.equal(resultedString, string)
      })
    })

    fixtures[fixture].invalid.forEach(({ string, exception }) => {
      it(`Test invalid string: ${string}`, async function () {
        try {
          fixtureBase.decode(string)
        } catch (e) {
          assert.equal(e.message, exception)
        }
      })
    })
  })
}
