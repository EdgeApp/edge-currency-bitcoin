// @flow
import { makeFakeIos } from 'edge-core-js'
import { describe, it, before } from 'mocha'
import * as Factories from '../../src/index.js'
import { assert } from 'chai'
import fixtures from './fixtures.json'

for (const fixture of fixtures) {
  const CurrencyPluginFactory = Factories[fixture['factory']]
  const WALLET_TYPE = fixture['WALLET_TYPE']
  const keyName = WALLET_TYPE.split('wallet:')[1].split('-')[0] + 'Key'
  const xpubName = WALLET_TYPE.split('wallet:')[1].split('-')[0] + 'Xpub'

  const [fakeIo] = makeFakeIos(1)
  const opts = {
    io: Object.assign(fakeIo, {
      random: size => fixture['key'],
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

    it('Test Currency code', function () {
      assert.equal(
        plugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
    })
  })

  describe(`createPrivateKey for Wallet type ${WALLET_TYPE}`, function () {
    let plugin

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
      const keys = plugin.createPrivateKey(WALLET_TYPE)
      assert.equal(!keys, false)
      assert.equal(typeof keys[keyName], 'string')
      const length = keys[keyName].split(' ').length
      assert.equal(length, 24)
    })
  })

  describe(`derivePublicKey for Wallet type ${WALLET_TYPE}`, function () {
    let plugin
    let keys

    before('Plugin', function (done) {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        assert.equal(
          currencyPlugin.currencyInfo.currencyCode,
          fixture['Test Currency code']
        )
        plugin = currencyPlugin
        keys = plugin.createPrivateKey(WALLET_TYPE)
        done()
      })
    })

    it('Valid private key', function (done) {
      plugin
        .derivePublicKey({
          type: WALLET_TYPE,
          keys: { [keyName]: keys[keyName] }
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
    let plugin

    before('Plugin', function () {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        assert.equal(
          currencyPlugin.currencyInfo.currencyCode,
          fixture['Test Currency code']
        )
        plugin = currencyPlugin
      })
    })
    Object.keys(fixture['parseUri']).forEach(test => {
      it(test, function () {
        const parsedUri = plugin.parseUri(fixture['parseUri'][test][0])
        assert.equal(parsedUri.publicAddress, fixture['parseUri'][test][1])
        assert.equal(parsedUri.nativeAmount, fixture['parseUri'][test][2])
        assert.equal(parsedUri.currencyCode, fixture['parseUri'][test][3])
        assert.equal(parsedUri.metadata.name, fixture['parseUri'][test][4])
        assert.equal(parsedUri.metadata.message, fixture['parseUri'][test][5])
        assert.equal(parsedUri.legacyAddress, fixture['parseUri'][test][6])
      })
    })
  })

  describe(`encodeUri for Wallet type ${WALLET_TYPE}`, function () {
    let plugin

    before('Plugin', function () {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        plugin = currencyPlugin
      })
    })
    Object.keys(fixture['encodeUri']).forEach(test => {
      it(test, function () {
        if (fixture['encodeUri'][test].length === 2) {
          const encodedUri = plugin.encodeUri(fixture['encodeUri'][test][0])
          assert.equal(encodedUri, fixture['encodeUri'][test][1])
        }
      })
    })
    it('invalid currencyCode', function () {
      assert.throws(() => {
        plugin.encodeUri(fixture['encodeUri']['invalid currencyCode'][0])
      })
    })
  })
}
