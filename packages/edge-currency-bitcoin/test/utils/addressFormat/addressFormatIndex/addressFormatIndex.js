import { assert } from 'chai'
import { describe, it } from 'mocha'

// @flow
// eslint-disable-next-line no-unused-vars
import * as Factories from '../../../../src/index.js'
import {
  isValidAddress,
  toLegacyFormat,
  toNewFormat,
  changeNetwork
} from '../../../../src/utils/addressFormat/addressFormatIndex.js'
import fixtures from './fixtures.json'

for (const fixture of fixtures) {
  const { network } = fixture

  describe(`Address format for ${network}`, function () {
    fixture['valid'].forEach(address => {
      it(`test valid for ${address}`, function () {
        assert.notEqual(isValidAddress(address, network), null)
      })
    })

    fixture['valid'].forEach(address => {
      it(`test convertion to valid bitcoin ${address}`, function () {
        assert.equal(changeNetwork(address, network), address)
      })
    })

    fixture['valid'].forEach(address => {
      it(`test convertion to valid bitcoin ${address}`, function () {
        assert.equal(changeNetwork(address, network), address)
      })
    })

    fixture['inValid'].forEach(address => {
      it(`test invalid for ${address}`, function () {
        assert.equal(isValidAddress(address, network), null)
      })
    })

    fixture['toLegacy'].forEach(([address, expected]) => {
      it(`get legacy format for ${address}`, function () {
        assert.equal(toLegacyFormat(address, network), expected)
      })
    })

    fixture['toNewFormat'].forEach(([address, expected]) => {
      it(`get new format for ${address}`, function () {
        assert.equal(toNewFormat(address, network), expected)
      })
    })
  })
}
