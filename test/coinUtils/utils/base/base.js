// @flow
import { base } from '../../../../src/coinUtils/utils/base.js'
import { describe, it } from 'mocha'
import { assert } from 'chai'
import fixtures from './fixtures.json'

for (const fixture in fixtures) {
  describe(`Testing base ${fixture}`, function () {
    const fixtureBase = base[fixture].check

    fixtures[fixture].valid.forEach(({ string, payload }) => {
      it(`Decode valid string: ${string}`, async function () {
        const resultedPaylod = await fixtureBase.decode(string)
        assert.equal(resultedPaylod.toString('hex'), payload)
      })
      it(`Encode valid payload: ${payload}`, async function () {
        const resultedString = await fixtureBase.encode(
          Buffer.from(payload, 'hex')
        )
        assert.equal(resultedString, string)
      })
    })

    fixtures[fixture].invalid.forEach(({ string, exception }) => {
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
