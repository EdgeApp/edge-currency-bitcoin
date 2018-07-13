// @flow
import { makeFakeIos } from 'edge-core-js'
import { describe, it, before } from 'mocha'
import * as Factories from '../../../../src/index.js'
import { assert } from 'chai'
import {
  toLegacyFormat,
  toNewFormat
} from '../../../../src/utils/addressFormat/addressFormatIndex.js'
import fixtures from './fixtures.json'

for (const fixture of fixtures) {
  const CurrencyPluginFactory = Factories[fixture['factory']]
  const WALLET_TYPE = fixture['WALLET_TYPE']

  const [fakeIo] = makeFakeIos(1)
  const opts = {
    io: Object.assign(fakeIo, {
      random: size => {},
      Socket: require('net').Socket,
      TLSSocket: require('tls').TLSSocket
    })
  }

  describe(`Address format for Wallet type ${WALLET_TYPE}`, function () {
    let plugin

    before('Create Plugin', function (done) {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        plugin = currencyPlugin
        done()
      })
    })

    fixture['valid'].forEach(address => {
      it(`test valid for ${address}`, function () {
        plugin.encodeUri({ publicAddress: address })
      })
    })

    fixture['inValid'].forEach(address => {
      it(`test invalid for ${address}`, function () {
        assert.throws(() => {
          plugin.encodeUri({ publicAddress: address })
        }, 'InvalidPublicAddressError')
      })
    })

    fixture['toLegacy'].forEach(([address, expected]) => {
      it(`get legacy format for ${address}`, function () {
        assert(
          toLegacyFormat(
            address,
            fixture['WALLET_TYPE'].split('wallet:')[1]
          ) === expected
        )
      })
    })

    fixture['toNewFormat'].forEach(([address, expected]) => {
      it(`get new format for ${address}`, function () {
        assert(
          toNewFormat(
            address,
            fixture['WALLET_TYPE'].split('wallet:')[1]
          ) === expected
        )
      })
    })
  })
}
