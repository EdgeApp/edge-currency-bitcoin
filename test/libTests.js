/* global describe it */
let BitcoinPlugin = require('../lib/index.js').BitcoinPlugin
let assert = require('assert')
let disklet = require('disklet')

let opts = {
  io: {
    fetch: () => true,
    random: (size) => Array(size).fill(0).map((x, i) => i),
    net: require('net')
  }
}

describe('Info', function () {
  let plugin

  before('Plugin', function (done) {
    BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
      plugin = bitcoinPlugin
      done()
    })
  })

  it('Test Currency code', function () {
    assert.equal(plugin.currencyInfo.currencyCode, 'BTC')
  })
})

describe('createPrivateKey', function () {
  let plugin

  before('Plugin', function (done) {
    BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
      plugin = bitcoinPlugin
      done()
    })
  })

  it('Test Currency code', function () {
    assert.equal(plugin.currencyInfo.currencyCode, 'BTC')
  })

  it('Create valid key', function () {
    let keys = plugin.createPrivateKey('wallet:bitcoin')
    assert.equal(!keys, false)
    assert.equal(typeof keys.bitcoinKey, 'string')
    var a = Buffer.from(keys.bitcoinKey, 'base64')
    var b = a.toString('hex')
    assert.equal(b, '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f')
  })
})

describe('derivePublicKey', function () {
  let plugin
  let keys

  before('Plugin', function (done) {
    BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
      assert.equal(bitcoinPlugin.currencyInfo.currencyCode, 'BTC')
      plugin = bitcoinPlugin
      keys = plugin.createPrivateKey('wallet:bitcoin')
      done()
    })
  })
  it('Valid private key', function () {
    keys = plugin.derivePublicKey({type: 'wallet:bitcoin', keys: {bitcoinKey: keys.bitcoinKey}})
    assert.equal(keys.bitcoinXpub, 'xpub661MyMwAqRbcFiyme9xRZe855HWfYxvTcYoWpX1E8ZW8DGu35DbthdTxz222XRihFsxrdH4BCEe32DBRyKEerW8CUMAB8FDziiNyDG4ecgT')
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

describe('Engine', function () {
  let plugin
  let keys
  let engine

  before('Plugin', function (done) {
    BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
      assert.equal(bitcoinPlugin.currencyInfo.currencyCode, 'BTC')
      plugin = bitcoinPlugin
      keys = plugin.createPrivateKey('wallet:bitcoin')
      keys = plugin.derivePublicKey({type: 'wallet:bitcoin', keys: {bitcoinKey: keys.bitcoinKey}})
      done()
    })
  })

  it('Create Engine', function () {
    let callbacks = {
      onAddressesChecked (progressRatio) {
        console.log('onAddressesCheck', progressRatio)
      },
      onBalanceChanged (currencyCode, balance) {
        console.log('onBalanceChange:' + currencyCode + ' ' + balance)
      },
      onBlockHeightChanged (height) {
        console.log('onBlockHeightChange', height)
      },
      onNewTransactions (transactionList) {
        console.log('onNewTransactions')
        console.log(transactionList)
      },
      onTransactionsChanged (transactionList) {
        console.log('onTransactionsChanged')
        console.log(transactionList)
      }
    }
    let walletLocalFolder = disklet.makeMemoryFolder()

    engine = plugin.makeEngine({type: 'wallet:bitcoin', keys}, { callbacks, walletLocalFolder })

    assert.equal(typeof engine.startEngine, 'function', 'startEngine')
    assert.equal(typeof engine.killEngine, 'function', 'killEngine')
    assert.equal(typeof engine.enableTokens, 'function', 'enableTokens')
    assert.equal(typeof engine.getBlockHeight, 'function', 'getBlockHeight')
    assert.equal(typeof engine.getBalance, 'function', 'getBalance')
    assert.equal(typeof engine.getNumTransactions, 'function', 'getNumTransactions')
    assert.equal(typeof engine.getTransactions, 'function', 'getTransactions')
    assert.equal(typeof engine.getFreshAddress, 'function', 'getFreshAddress')
    // assert.equal(typeof engine.addGapLimitAddresses, 'function', 'addGapLimitAddresses')
    assert.equal(typeof engine.isAddressUsed, 'function', 'isAddressUsed')
    assert.equal(typeof engine.makeSpend, 'function', 'makeSpend')
    assert.equal(typeof engine.signTx, 'function', 'signTx')
    assert.equal(typeof engine.broadcastTx, 'function', 'broadcastTx')
    assert.equal(typeof engine.saveTx, 'function', 'saveTx')
  })

  it('Start Engine', function (done) {
    engine.startEngine().then(a => {
      // console.log(engine)
      done()
    })
  })
  it('Get Transactions', function (done) {
    engine.getTransactions({
      startIndex: 0,
      numEnteries: 100
    }).then(tx => {
      console.log(1, tx)
      done()
    }).catch(e => {
      console.log(2, e)
      done()
    })
  })
})
