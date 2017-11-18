import { describe, it, before } from 'mocha'
import { BitcoinPluginFactory } from '../../../src/index.js'
import { assert } from 'chai'
const WALLET_TYPE = 'wallet:bitcoin'

const opts = {
  io: {
    fetch: () => true,
    random: (size) => [39, 190, 34, 129, 208, 32, 145, 88, 191, 217, 226, 98, 183, 16, 52, 150, 52, 53, 31, 137, 164, 40, 236, 146, 128, 107, 129, 59, 192, 240, 40, 238],
    net: require('net')
  }
}

describe(`Info for Wallet type ${WALLET_TYPE}`, function () {
  let plugin

  before('Plugin', function (done) {
    BitcoinPluginFactory.makePlugin(opts).then((bitcoinPlugin) => {
      plugin = bitcoinPlugin
      done()
    })
  })

  it('Test Currency code', function () {
    assert.equal(plugin.currencyInfo.currencyCode, 'BTC')
  })
})

describe(`createPrivateKey for Wallet type ${WALLET_TYPE}`, function () {
  let plugin

  before('Plugin', function (done) {
    BitcoinPluginFactory.makePlugin(opts).then((bitcoinPlugin) => {
      plugin = bitcoinPlugin
      done()
    })
  })

  it('Test Currency code', function () {
    assert.equal(plugin.currencyInfo.currencyCode, 'BTC')
  })

  it('Create valid key', function () {
    const keys = plugin.createPrivateKey('wallet:bitcoin')
    assert.equal(!keys, false)
    assert.equal(typeof keys.bitcoinKey, 'string')
    const length = keys.bitcoinKey.split(' ').length
    assert.equal(length, 24)
  })
})

describe(`derivePublicKey for Wallet type ${WALLET_TYPE}`, function () {
  let plugin
  let keys

  before('Plugin', function (done) {
    BitcoinPluginFactory.makePlugin(opts).then((bitcoinPlugin) => {
      assert.equal(bitcoinPlugin.currencyInfo.currencyCode, 'BTC')
      plugin = bitcoinPlugin
      keys = plugin.createPrivateKey('wallet:bitcoin')
      done()
    })
  })
  it('Valid private key', function () {
    keys = plugin.derivePublicKey({type: 'wallet:bitcoin', keys: {bitcoinKey: keys.bitcoinKey}})
    assert.equal(keys.bitcoinXpub, 'xpub661MyMwAqRbcF6JxG5NqmWiCbURzYtg95A5T7m6bdJ27FHDuLcVHmAg4unEMvdNi5VniUWgxxDJM5odBjUUzuSNCciED3sbfdX37NsdKTiQ')
  })

  it('Invalid key name', function () {
    assert.throws(() => {
      plugin.derivePublicKey({
        type: 'wallet:bitcoin',
        keys: {'bitcoinKeyz': '12345678abcd'}
      })
    })
  })

  it('Invalid wallet type', function () {
    assert.throws(() => {
      plugin.derivePublicKey({
        type: 'shitcoin',
        keys: {'bitcoinKey': '12345678abcd'}
      })
    })
  })
})

describe(`parseUri for Wallet type ${WALLET_TYPE}`, function () {
  let plugin

  before('Plugin', function () {
    BitcoinPluginFactory.makePlugin(opts).then((bitcoinPlugin) => {
      assert.equal(bitcoinPlugin.currencyInfo.currencyCode, 'BTC')
      plugin = bitcoinPlugin
    })
  })
  it('address only', function () {
    const parsedUri = plugin.parseUri('1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.publicAddress, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.nativeAmount, undefined)
    assert.equal(parsedUri.currencyCode, undefined)
  })
  it('uri address', function () {
    const parsedUri = plugin.parseUri('bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.publicAddress, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.nativeAmount, undefined)
    assert.equal(parsedUri.currencyCode, undefined)
  })
  it('uri address with amount', function () {
    const parsedUri = plugin.parseUri('bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=12345.6789')
    assert.equal(parsedUri.publicAddress, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.nativeAmount, '1234567890000')
    assert.equal(parsedUri.currencyCode, 'BTC')
  })
  it('uri address with amount & label', function () {
    const parsedUri = plugin.parseUri('bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.56789&label=Johnny%20Bitcoin')
    assert.equal(parsedUri.publicAddress, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.nativeAmount, '123456789000')
    assert.equal(parsedUri.currencyCode, 'BTC')
    assert.equal(parsedUri.metadata.label, 'Johnny Bitcoin')
  })
  it('uri address with amount, label & message', function () {
    const parsedUri = plugin.parseUri('bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.56789&label=Johnny%20Bitcoin&message=Hello%20World,%20I%20miss%20you%20!')
    assert.equal(parsedUri.publicAddress, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.nativeAmount, '123456789000')
    assert.equal(parsedUri.currencyCode, 'BTC')
    assert.equal(parsedUri.metadata.label, 'Johnny Bitcoin')
    assert.equal(parsedUri.metadata.message, 'Hello World, I miss you !')
  })
  it('uri address with unsupported param', function () {
    const parsedUri = plugin.parseUri('bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?unsupported=helloworld&amount=12345.6789')
    assert.equal(parsedUri.publicAddress, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.nativeAmount, '1234567890000')
    assert.equal(parsedUri.currencyCode, 'BTC')
  })
})

describe(`encodeUri for Wallet type ${WALLET_TYPE}`, function () {
  let plugin

  before('Plugin', function () {
    BitcoinPluginFactory.makePlugin(opts).then((bitcoinPlugin) => {
      plugin = bitcoinPlugin
    })
  })
  it('address only', function () {
    const encodedUri = plugin.encodeUri({publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX'})
    assert.equal(encodedUri, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
  })
  it('address & amount', function () {
    const encodedUri = plugin.encodeUri(
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        nativeAmount: '123456780000'
      }
    )
    assert.equal(encodedUri, 'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.5678')
  })
  it('address, amount, and label', function () {
    const encodedUri = plugin.encodeUri(
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        nativeAmount: '123456780000',
        currencyCode: 'BTC',
        metadata: {
          label: 'Johnny Bitcoin'
        }
      }
    )
    assert.equal(encodedUri, 'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.5678&label=Johnny%20Bitcoin')
  })
  it('address, amount, label, & message', function () {
    const encodedUri = plugin.encodeUri(
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        nativeAmount: '123456780000',
        currencyCode: 'BTC',
        metadata: {
          label: 'Johnny Bitcoin',
          message: 'Hello World, I miss you !'
        }
      }
    )
    assert.equal(encodedUri, 'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.5678&label=Johnny%20Bitcoin&message=Hello%20World,%20I%20miss%20you%20!')
  })
  it('invalid currencyCode', function () {
    assert.throws(() => {
      plugin.encodeUri(
        {
          publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
          nativeAmount: '123456780000',
          currencyCode: 'INVALID',
          metadata: {
            label: 'Johnny Bitcoin',
            message: 'Hello World, I miss you !'
          }
        }
      )
    })
  })
})
