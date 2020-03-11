// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'

import { search } from '../../src/utils/jsonSearch.js'
import { fixtures, jsonObj } from './fixtures/jsonSearch.js'

describe('Testing Json Search', function () {
  fixtures.forEach(([ test, expected ]) => {
    it(`Testing search with: ${JSON.stringify(test)} and no limit`, function () {
      const searchParams = {
        path: test[0],
        value: test[1]
      }
      const results = search(searchParams, jsonObj)
      assert.deepEqual(results, expected)
    })

    for (let i = 1; i <= expected.length; i++) {
      it(`Testing search with: ${JSON.stringify(test)} and limit ${i}`, function () {
        const searchParams = {
          path: test[0],
          value: test[1],
          limit: i
        }
        const results = search(searchParams, jsonObj)
        assert.deepEqual(results, expected.slice(0, i))
      })
    }
  })
})
