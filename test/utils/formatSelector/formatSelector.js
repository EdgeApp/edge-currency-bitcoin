// @flow
import {
  getDerivationConfiguration,
  getXPubFromSeed,
  getAllAddresses,
  getAllKeyRings
} from '../../../src/utils/formatSelector.js'

import type { DerivationConfig } from '../../../src/utils/coinUtils.js'

import { describe, it } from 'mocha'
import { assert } from 'chai'
// import { primitives } from 'bcoin'
// eslint-disable-next-line no-unused-vars
import * as Factories from '../../../src/index'
import fixtures from './fixtures.json'

for (const fixture of fixtures) {
  describe('getDerivationConfiguration', function () {
    fixture['derivationConfiguration'].forEach(([network, bip, expectedConfig]) => {
      it('Test getDerivationConfiguration', function () {
        const config: DerivationConfig = getDerivationConfiguration(bip, network)
        assert.equal(config.nested, expectedConfig.nested)
        assert.equal(config.witness, expectedConfig.witness)
        // assert.equal(config.branches, expectedConfig.branches)
        assert.equal(config.network, expectedConfig.network)
        assert.equal(config.bip, expectedConfig.bip)
        // assert.equal(config.scriptTemplates, expectedConfig.scriptTemplates)
      })
    })
  })

  describe('getXPubFromSeed', function () {
    fixture['pubFromSeed'].forEach(([network, format, seed, account, coinType, expected]) => {
      it('Test getXPubFromSeed', async function () {
        const xpubKey = await getXPubFromSeed({ seed, network, account, format, coinType })
        assert.equal(xpubKey, expected)
      })
    })
  })

  describe('getAllKeyRings', function () {
    fixture['allKeyRings'].forEach(([network, keys, expected]) => {
      it('Test getAllKeyRings', async function () {
        const keyRings = await getAllKeyRings(keys, network)
        for (let index = 0; index < keyRings.length; index++) {
          assert.equal(keyRings[index].toJSON().address, expected[index].address)
          assert.equal(keyRings[index].toJSON().publicKey, expected[index].publicKey)
        }
      })
    })
  })

  describe('getAllAddresses', function () {
    fixture['allAddresses'].forEach(([network, keys, expected]) => {
      it('Test getAllAddresses', async function () {
        const addresses = await getAllAddresses(keys, network)
        for (let index = 0; index < addresses.length; index++) {
          assert.equal(addresses[index].address, expected[index].address)
          assert.equal(addresses[index].scriptHash, expected[index].scriptHash)
        }
      })
    })
  })
}
