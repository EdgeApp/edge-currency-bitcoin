// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'
import { base } from '../../src/utils/base.js'
import fixtures from './fixtures.json'

const baseFixtures = fixtures.base

for (const fixture in baseFixtures) {
  describe(`Testing base ${fixture}`, function () {
    const fixtureBase = base[fixture].check

    baseFixtures[fixture].valid.forEach(({ string, payload }) => {
      it(`Decode valid string: ${string}`, async function () {
        const resultedPaylod = await fixtureBase.decode(string)
        assert.equal(resultedPaylod, payload)
      })
      it(`Encode valid payload: ${payload}`, async function () {
        const resultedString = await fixtureBase.encode(payload)
        assert.equal(resultedString, string)
      })
    })

    baseFixtures[fixture].invalid.forEach(({ string, exception }) => {
      it(`Test invalid string: ${string}`, async function () {
        try {
          await fixtureBase.decode(string)
        } catch (e) {
          assert.equal(e.message, exception)
        }
      })
    })
  })
}
