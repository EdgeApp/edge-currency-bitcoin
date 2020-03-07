// @flow

import { assert } from 'chai'
import { after, before, describe, it } from 'mocha'

import { persist } from '../../../../src/utils/nidavellir/utils/persister.js'
import fixtures from './fixtures.json'

const createSave = (expected: any, delay: number, cbs: any) => {
  let saveAttempts = -1
  let firstSaveTime = 0

  return async cacheData => {
    if (cbs.stop) return
    cbs.e = new Error()

    assert.notEqual(cacheData, expected)
    assert.deepEqual(cacheData, expected)

    saveAttempts++
    if (!firstSaveTime) firstSaveTime = Date.now()
    const saveTime = Date.now() - firstSaveTime

    if (delay) {
      const minDelay = delay * saveAttempts
      assert.isAtLeast(saveTime, minDelay)
    }

    cbs.e = null
    // console.log(saveTime, '- SAVE -', cacheData, saveAttempts)
  }
}

const cbs = {}

for (const test in fixtures.persister) {
  const testNum = test.replace('scenario ', '')
  const { cache, delay, sets } = fixtures.persister[test]
  const expected = JSON.parse(JSON.stringify(cache || {}))
  const save = createSave(expected, delay, cbs)
  const load = testNum !== '1' ? (): Object => expected : cache
  const persistedCache = persist(save, load, delay)

  describe(`Testing persister for ${test} with delay of ${delay ||
    100}ms`, function () {
    this.timeout(0)
    before('Test using cache as a function', async function () {
      cbs.stop = false
      await persistedCache({})
      await persistedCache(cache)
    })

    sets.map(([param, value, saveTime], i) => {
      it(`Set '${param}' to ${value}, after ${saveTime} milliseconds`, function (done) {
        let child = persistedCache
        let expectedChild = expected

        param = param.split('.')
        while (param.length > 1) {
          const key = param.shift()
          child = child[key]
          expectedChild = expectedChild[key]
        }

        const key = param[0]
        const interval = !i ? saveTime : saveTime - sets[i - 1][2]

        setTimeout(() => {
          expectedChild[key] = value
          child[key] = value
          assert.equal(expectedChild[key], child[key])
          done(cbs.e)
        }, interval)
      })
    })

    after('Stop the caceh using cache as a function', async function () {
      cbs.stop = true
      await persistedCache('stop')
    })
  })
}
