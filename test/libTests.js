/* global describe it */
let BitcoinPlugin = require('../lib/index.js').BitcoinPlugin
let assert = require('assert')
const { bns } = require('biggystring')

let opts = {
  io: {
    fetch: () => true,
    random: (size) => Array(size).fill(0).map((x, i) => i)
  }
}
// describe('Plugin', function () {
//   it('Get currency info', function () {
//     BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
//       assert.equal(bitcoinPlugin.currencyInfo.currencyCode, 'BTC')
//     })
//   })
//   it('Get block height', function () {
//     BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
//       const walletInfoPrivate = bitcoinPlugin.createPrivateKey('wallet:bitcoin')
//       const walletInfoPublic = bitcoinPlugin.derivePublicKey(walletInfoPrivate)
//       const keys = Object.assign({}, walletInfoPrivate.keys, walletInfoPublic.keys)
//       const walletInfo = walletInfoPublic
//       walletInfo.keys = keys
//       const engine = bitcoinPlugin.makeEngine(walletInfo)

//       engine.startEngine()
//       const height = engine.getBlockHeight()
//       const success = (height === '0' || bns.gt(height, '100000'))

//       assert.equal(success, true)
//     })
//   })
// })

describe('Info', function () {
  let plugin

  before('Plugin', function () {
    BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
      plugin = bitcoinPlugin
    })
  })

  it('Test Currency code', function () {
    assert.equal(plugin.currencyInfo.currencyCode, 'BTC')
  })
})

describe('createPrivateKey', function () {
  let plugin

  before('Plugin', function () {
    BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
      plugin = bitcoinPlugin
    })
  })

  it('Test Currency code', function () {
    assert.equal(plugin.currencyInfo.currencyCode, 'BTC')
  })

  it('Create valid key', function () {
    let walletInfo = plugin.createPrivateKey('wallet:bitcoin')
    assert.equal(!walletInfo.keys, false)
    assert.equal(typeof walletInfo.keys.bitcoinKey, 'string')
    var a = Buffer.from(walletInfo.keys.bitcoinKey, 'base64')
    var b = a.toString('hex')
    assert.equal(b, '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f')
  })
})

describe('derivePublicKey', function () {
  let plugin

  before('Plugin', function () {
    BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
      assert.equal(bitcoinPlugin.currencyInfo.currencyCode, 'BTC')
      plugin = bitcoinPlugin
    })
  })
  it('Valid private key', function () {
    const walletInfo = plugin.derivePublicKey({
      type: 'bitcoin',
      keys: {'bitcoinKey': '12345678abcd'}
    })
    assert.equal(walletInfo.keys.masterPublicKey.toLowerCase(), 'pub12345678abcd'.toLowerCase())
  })

  it('Invalid key name', function () {
    assert.throws(() => {
      plugin.derivePublicKey({
        type: 'bitcoin',
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

describe('parseUri', function () {
  let plugin

  before('Plugin', function () {
    BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
      assert.equal(bitcoinPlugin.currencyInfo.currencyCode, 'BTC')
      plugin = bitcoinPlugin
    })
  })
  it('address only', function () {
    let parsedUri = plugin.parseUri('1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.publicAddress, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.nativeAmount, null)
    assert.equal(parsedUri.currencyCode, null)
  })
  it('uri address', function () {
    let parsedUri = plugin.parseUri('bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.publicAddress, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.nativeAmount, null)
    assert.equal(parsedUri.currencyCode, null)
  })
  it('uri address with amount', function () {
    let parsedUri = plugin.parseUri('bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=12345.6789')
    assert.equal(parsedUri.publicAddress, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.nativeAmount, '1234567890000')
    assert.equal(parsedUri.currencyCode, 'BTC')
  })
  it('uri address with amount & label', function () {
    let parsedUri = plugin.parseUri('bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.56789&label=Johnny%20Bitcoin')
    assert.equal(parsedUri.publicAddress, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.nativeAmount, '123456789000')
    assert.equal(parsedUri.currencyCode, 'BTC')
    assert.equal(parsedUri.label, 'Johnny Bitcoin')
  })
  it('uri address with amount, label & message', function () {
    let parsedUri = plugin.parseUri('bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.56789&label=Johnny%20Bitcoin&message=Hello%20World,%20I%20miss%20you%20!')
    assert.equal(parsedUri.publicAddress, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.nativeAmount, '123456789000')
    assert.equal(parsedUri.currencyCode, 'BTC')
    assert.equal(parsedUri.label, 'Johnny Bitcoin')
    assert.equal(parsedUri.message, 'Hello World, I miss you !')
  })
  it('uri address with unsupported param', function () {
    let parsedUri = plugin.parseUri('bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?unsupported=helloworld&amount=12345.6789')
    assert.equal(parsedUri.publicAddress, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
    assert.equal(parsedUri.nativeAmount, '1234567890000')
    assert.equal(parsedUri.currencyCode, 'BTC')
  })
})

describe('encodeUri', function () {
  let plugin

  before('Plugin', function () {
    BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
      plugin = bitcoinPlugin
    })
  })
  it('address only', function () {
    let encodedUri = plugin.encodeUri({publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX'})
    assert.equal(encodedUri, '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX')
  })
  it('address & amount', function () {
    let encodedUri = plugin.encodeUri(
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        nativeAmount: '123456780000'
      }
    )
    assert.equal(encodedUri, 'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.5678')
  })
  it('address, amount, and label', function () {
    let encodedUri = plugin.encodeUri(
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        nativeAmount: '123456780000',
        currencyCode: 'BTC',
        label: 'Johnny Bitcoin'
      }
    )
    assert.equal(encodedUri, 'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.5678&label=Johnny%20Bitcoin')
  })
  it('address, amount, label, & message', function () {
    let encodedUri = plugin.encodeUri(
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        nativeAmount: '123456780000',
        currencyCode: 'BTC',
        label: 'Johnny Bitcoin',
        message: 'Hello World, I miss you !'
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
          label: 'Johnny Bitcoin',
          message: 'Hello World, I miss you !'
        }
      )
    })
  })
})
