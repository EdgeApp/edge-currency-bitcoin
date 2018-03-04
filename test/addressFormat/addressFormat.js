// @flow
import { makeFakeIos } from 'edge-login'
import { describe, it, before } from 'mocha'
import * as Factories from '../../src/index.js'
import { assert } from 'chai'
import {
  toLegacyFormat,
  toNewFormat
} from '../../src/utils/addressFormat/addressFormatIndex.js'
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

  describe(`Info for Wallet type ${WALLET_TYPE}`, function () {
    let plugin

    before('Plugin', function (done) {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        plugin = currencyPlugin
        done()
      })
    })

    it('test valid addresses', function () {
      for (const address of fixture['valid']) {
        plugin.encodeUri({ publicAddress: address })
      }
    })

    it('test invalid addresses', function () {
      for (const address of fixture['inValid']) {
        assert.throws(() => {
          plugin.encodeUri({ publicAddress: address })
        }, 'InvalidPublicAddressError')
      }
    })

    it('get legacy format', function () {
      for (const address of fixture['toLegacy']) {
        console.log(address)
        assert(
          toLegacyFormat(
            address[0],
            fixture['WALLET_TYPE'].split('wallet:')[1]
          ) === address[1]
        )
      }
    })

    it('get new format', function () {
      for (const address of fixture['toNewFormat']) {
        console.log(address)
        assert(
          toNewFormat(
            address[0],
            fixture['WALLET_TYPE'].split('wallet:')[1]
          ) === address[1]
        )
      }
    })
  })
}
