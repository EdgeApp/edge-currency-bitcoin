// @flow

import { expect } from 'chai'
import { describe, it } from 'mocha'

import { parseTransaction } from '../../../src/utils/coinUtils.js'
// eslint-disable-next-line no-unused-vars
import fixtures from './fixtures.json'

describe(`Parse Transaction`, function () {
  Object.keys(fixtures).forEach(testName => {
    it(`${testName}`, function () {
      const [txData, expected] = fixtures[testName]
      const parsedData: any = parseTransaction(txData)
      expected.inputs.forEach(({ txid, index }, i) => {
        expect(parsedData.inputs[i].prevout.rhash()).to.equal(txid)
        expect(parsedData.inputs[i].prevout.index).to.equal(index)
      })
      expected.outputs.forEach(({ scriptHash, value }, i) => {
        expect(parsedData.outputs[i].scriptHash).to.equal(scriptHash)
        expect(parsedData.outputs[i].value).to.equal(value)
      })
    })
  })
})
