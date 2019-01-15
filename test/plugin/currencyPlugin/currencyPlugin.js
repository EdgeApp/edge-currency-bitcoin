// @flow
import { makeFakeIos } from 'edge-core-js'
import { describe, it, before } from 'mocha'
import * as Factories from '../../../src/index.js'
import { assert } from 'chai'
import fixtures from './fixtures.json'

for (const fixture of fixtures) {
  const CurrencyPluginFactory = Factories[fixture['factory']]
  const WALLET_TYPE = fixture['WALLET_TYPE']
  const WALLET_FORMAT = fixture['WALLET_FORMAT']
  const keyName = WALLET_TYPE.split('wallet:')[1].split('-')[0] + 'Key'
  const xpubName = WALLET_TYPE.split('wallet:')[1].split('-')[0] + 'Xpub'
  let plugin, keys

  const [fakeIo] = makeFakeIos(1)
  const opts = {
    io: {
      ...fakeIo,
      random: size => fixture['key'],
      Socket: require('net').Socket,
      TLSSocket: require('tls').TLSSocket
    }
  }

  describe(`Info for Wallet type ${WALLET_TYPE}`, function () {
    before('Plugin', function (done) {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        plugin = currencyPlugin
        assert.equal(
          currencyPlugin.currencyInfo.currencyCode,
          fixture['Test Currency code']
        )
        done()
      })
    })

    it('Test Currency code', function () {
      assert.equal(
        plugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
    })
  })

  describe(`createPrivateKey for Wallet type ${WALLET_TYPE}`, function () {
    before('Plugin', function (done) {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        plugin = currencyPlugin
        done()
      })
    })

    it('Test Currency code', function () {
      assert.equal(
        plugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
    })

    it('Create valid key', function () {
      keys = plugin.createPrivateKey(WALLET_TYPE)
      assert.equal(!keys, false)
      assert.equal(typeof keys[keyName], 'string')
      const length = keys[keyName].split(' ').length
      assert.equal(length, 24)
    })
  })

  describe(`derivePublicKey for Wallet type ${WALLET_TYPE}`, function () {
    it('Valid private key', function (done) {
      plugin
        .derivePublicKey({
          type: WALLET_TYPE,
          keys: {
            [keyName]: keys[keyName],
            format: WALLET_FORMAT
          }
        })
        .then(keys => {
          assert.equal(keys[xpubName], fixture['xpub'])
          done()
        })
    })

    it('Invalid key name', function (done) {
      plugin.derivePublicKey(fixture['Invalid key name']).catch(e => {
        done()
      })
    })

    it('Invalid wallet type', function (done) {
      plugin.derivePublicKey(fixture['Invalid wallet type']).catch(e => {
        done()
      })
    })
  })

  describe(`parseUri for Wallet type ${WALLET_TYPE}`, function () {
    Object.keys(fixture['parseUri']).forEach(test => {
      if (fixture['parseUri'][test].length === 2) {
        it(test, function () {
          const parsedUri = plugin.parseUri(fixture['parseUri'][test][0])
          const expectedParsedUri = fixture['parseUri'][test][1]
          assert.deepEqual(parsedUri, expectedParsedUri)
        })
      } else {
        it(test, function () {
          assert.throws(() => plugin.parseUri(fixture['parseUri'][test][0]))
        })
      }
    })
  })

  describe(`encodeUri for Wallet type ${WALLET_TYPE}`, function () {
    Object.keys(fixture['encodeUri']).forEach(test => {
      if (fixture['encodeUri'][test].length === 2) {
        it(test, function () {
          const encodedUri = plugin.encodeUri(fixture['encodeUri'][test][0])
          const expectedEncodeUri = fixture['encodeUri'][test][1]
          assert.equal(encodedUri, expectedEncodeUri)
        })
      } else {
        it(test, function () {
          assert.throws(() => plugin.encodeUri(fixture['encodeUri'][test][0]))
        })
      }
    })
  })

  describe(`getSplittableTypes for Wallet type ${WALLET_TYPE}`, function () {
    const getSplittableTypes = fixture['getSplittableTypes'] || []
    Object.keys(getSplittableTypes).forEach(format => {
      it(`Test for the wallet type ${format}`, function () {
        const walletTypes = plugin.getSplittableTypes({ keys: { format } })
        assert.deepEqual(walletTypes, getSplittableTypes[format])
      })
    })
  })
}
