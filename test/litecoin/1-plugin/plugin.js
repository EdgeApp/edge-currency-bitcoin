/* global describe it */
let LitecoinCurrencyPluginFactory = require('../../../lib/index.test.js').LitecoinCurrencyPluginFactory
let assert = require('assert')
const WALLET_TYPE = 'wallet:litecoin'

let opts = {
  io: {
    fetch: () => true,
    random: (size) => [39, 190, 34, 129, 208, 32, 145, 88, 191, 217, 226, 98, 183, 16, 52, 150, 52, 53, 31, 137, 164, 40, 236, 146, 128, 107, 129, 59, 192, 240, 40, 238],    
    net: require('net')
  }
}

describe(`Info for Wallet type ${WALLET_TYPE}`, function () {
  let plugin

  before('Plugin', function (done) {
    LitecoinCurrencyPluginFactory.makePlugin(opts).then((litecoinPlugin) => {
      plugin = litecoinPlugin
      done()
    })
  })

  it('Test Currency code', function () {
    assert.equal(plugin.currencyInfo.currencyCode, 'LTC')
  })
})

describe(`createPrivateKey for Wallet type ${WALLET_TYPE}`, function () {
  let plugin

  before('Plugin', function (done) {
    LitecoinCurrencyPluginFactory.makePlugin(opts).then((litecoinPlugin) => {
      plugin = litecoinPlugin
      done()
    })
  })

  it('Test Currency code', function () {
    assert.equal(plugin.currencyInfo.currencyCode, 'LTC')
  })

  it('Create valid key', function () {
    let keys = plugin.createPrivateKey('wallet:litecoin')
    assert.equal(!keys, false)
    assert.equal(typeof keys.litecoinKey, 'string')
    var a = Buffer.from(keys.litecoinKey, 'base64')
    var b = a.toString('hex')
    assert.equal(b, '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f')
  })
})

describe(`derivePublicKey for Wallet type ${WALLET_TYPE}`, function () {
  let plugin
  let keys

  before('Plugin', function (done) {
    LitecoinCurrencyPluginFactory.makePlugin(opts).then((litecoinPlugin) => {
      assert.equal(litecoinPlugin.currencyInfo.currencyCode, 'LTC')
      plugin = litecoinPlugin
      keys = plugin.createPrivateKey('wallet:litecoin')
      done()
    })
  })
  it('Valid private key', function () {
    keys = plugin.derivePublicKey({type: 'wallet:litecoin', keys: {litecoinKey: keys.litecoinKey}})
    assert.equal(keys.litecoinXpub, 'xpub661MyMwAqRbcFiyme9xRZe855HWfYxvTcYoWpX1E8ZW8DGu35DbthdTxz222XRihFsxrdH4BCEe32DBRyKEerW8CUMAB8FDziiNyDG4ecgT')
  })

  it('Invalid key name', function () {
    assert.throws(() => {
      plugin.derivePublicKey({
        type: 'wallet:litecoin',
        keys: {'litecoinz': '12345678abcd'}
      })
    })
  })

  it('Invalid wallet type', function () {
    assert.throws(() => {
      plugin.derivePublicKey({
        type: 'shitcoin',
        keys: {'litecoin': '12345678abcd'}
      })
    })
  })
})

describe(`parseUri for Wallet type ${WALLET_TYPE}`, function () {
  let plugin

  before('Plugin', function () {
    LitecoinCurrencyPluginFactory.makePlugin(opts).then((litecoinPlugin) => {
      assert.equal(litecoinPlugin.currencyInfo.currencyCode, 'LTC')
      plugin = litecoinPlugin
    })
  })
  it('address only', function () {
    let parsedUri = plugin.parseUri('LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T')
    assert.equal(parsedUri.publicAddress, 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T')
    assert.equal(parsedUri.nativeAmount, undefined)
    assert.equal(parsedUri.currencyCode, undefined)
  })
  it('uri address', function () {
    let parsedUri = plugin.parseUri('litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T')
    assert.equal(parsedUri.publicAddress, 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T')
    assert.equal(parsedUri.nativeAmount, undefined)
    assert.equal(parsedUri.currencyCode, undefined)
  })
  it('uri address with amount', function () {
    let parsedUri = plugin.parseUri('litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?amount=12345.6789')
    assert.equal(parsedUri.publicAddress, 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T')
    assert.equal(parsedUri.nativeAmount, '1234567890000')
    assert.equal(parsedUri.currencyCode, 'LTC')
  })
  it('uri address with amount & label', function () {
    let parsedUri = plugin.parseUri('litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?amount=1234.56789&label=Johnny%20Litecoin')
    assert.equal(parsedUri.publicAddress, 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T')
    assert.equal(parsedUri.nativeAmount, '123456789000')
    assert.equal(parsedUri.currencyCode, 'LTC')
    assert.equal(parsedUri.metadata.label, 'Johnny Litecoin')
  })
  it('uri address with amount, label & message', function () {
    let parsedUri = plugin.parseUri('litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?amount=1234.56789&label=Johnny%20Litecoin&message=Hello%20World,%20I%20miss%20you%20!')
    assert.equal(parsedUri.publicAddress, 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T')
    assert.equal(parsedUri.nativeAmount, '123456789000')
    assert.equal(parsedUri.currencyCode, 'LTC')
    assert.equal(parsedUri.metadata.label, 'Johnny Litecoin')
    assert.equal(parsedUri.metadata.message, 'Hello World, I miss you !')
  })
  it('uri address with unsupported param', function () {
    let parsedUri = plugin.parseUri('litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?unsupported=helloworld&amount=12345.6789')
    assert.equal(parsedUri.publicAddress, 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T')
    assert.equal(parsedUri.nativeAmount, '1234567890000')
    assert.equal(parsedUri.currencyCode, 'LTC')
  })
})

describe(`encodeUri for Wallet type ${WALLET_TYPE}`, function () {
  let plugin

  before('Plugin', function () {
    LitecoinCurrencyPluginFactory.makePlugin(opts).then((litecoinPlugin) => {
      plugin = litecoinPlugin
    })
  })
  it('address only', function () {
    let encodedUri = plugin.encodeUri({publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T'})
    assert.equal(encodedUri, 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T')
  })
  it('address & amount', function () {
    let encodedUri = plugin.encodeUri(
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        nativeAmount: '123456780000'
      }
    )
    assert.equal(encodedUri, 'litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?amount=1234.5678')
  })
  it('address, amount, and label', function () {
    let encodedUri = plugin.encodeUri(
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        nativeAmount: '123456780000',
        currencyCode: 'LTC',
        metadata: {
          label: 'Johnny Litecoin'
        }
      }
    )
    assert.equal(encodedUri, 'litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?amount=1234.5678&label=Johnny%20Litecoin')
  })
  it('address, amount, label, & message', function () {
    let encodedUri = plugin.encodeUri(
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        nativeAmount: '123456780000',
        currencyCode: 'LTC',
        metadata: {
          label: 'Johnny Litecoin',
          message: 'Hello World, I miss you !'
        }
      }
    )
    assert.equal(encodedUri, 'litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?amount=1234.5678&label=Johnny%20Litecoin&message=Hello%20World,%20I%20miss%20you%20!')
  })
  it('invalid currencyCode', function () {
    assert.throws(() => {
      plugin.encodeUri(
        {
          publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
          nativeAmount: '123456780000',
          currencyCode: 'INVALID',
          metadata: {
            label: 'Johnny Litecoin',
            message: 'Hello World, I miss you !'
          }
        }
      )
    })
  })
})
