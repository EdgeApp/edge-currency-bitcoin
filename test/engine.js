/* global describe it */
let BitcoinPlugin = require('../lib/index.js').BitcoinPlugin
let assert = require('assert')
let disklet = require('disklet')
let Emitter = require('events').EventEmitter
let request = require('request')

var emitter = new Emitter()

let opts = {
  io: {
    fetch: () => true,
    random: (size) => Array(size).fill(0).map((x, i) => i),
    net: require('net')
  }
}

let callbacks = {
  onAddressesChecked (progressRatio) {
    console.log('onAddressesCheck', progressRatio)
    emitter.emit('onAddressesCheck', progressRatio)
  },
  onBalanceChanged (currencyCode, balance) {
    console.log('onBalanceChange:' + currencyCode + ' ' + balance)
    emitter.emit('onBalanceChange', currencyCode, balance)
  },
  onBlockHeightChanged (height) {
    emitter.emit('onBlockHeightChange', height)
  },
  onNewTransactions (transactionList) {
    console.log('onNewTransactions')
    console.log(transactionList)
    emitter.emit('onNewTransactions', transactionList)
  },
  onTransactionsChanged (transactionList) {
    console.log('onTransactionsChanged')
    console.log(transactionList)
    emitter.emit('onTransactionsChanged', transactionList)
  }
}

describe('Engine', function () {
  let plugin
  let keys
  let engine
  let walletLocalFolder = disklet.makeMemoryFolder()

  before('Plugin', function (done) {
    BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
      assert.equal(bitcoinPlugin.currencyInfo.currencyCode, 'BTC')
      plugin = bitcoinPlugin
      keys = plugin.createPrivateKey('wallet:bitcoin')
      keys = plugin.derivePublicKey({type: 'wallet:bitcoin', keys: {bitcoinKey: keys.bitcoinKey}})
      done()
    })
  })

  it('Error when Making Engine without local folder', function () {
    let engine = plugin.makeEngine({type: 'wallet:bitcoin', keys}, { callbacks })
    return engine.startEngine().catch(e => {
      assert.equal(e.message, 'Cannot read property \'folder\' of undefined')
    })
  })

  it('Error when Making Engine without keys', function () {
    let engine = plugin.makeEngine({type: 'wallet:bitcoin'}, { callbacks, walletLocalFolder })
    return engine.startEngine().catch(e => {
      assert.equal(e.message, 'Missing Master Key')
    })
  })

  it('Error when Making Engine without bitcoin keys', function () {
    let wrongKeys = { bitcoinXpub: keys.pub }
    let engine = plugin.makeEngine({type: 'wallet:bitcoin', keys: wrongKeys}, { callbacks, walletLocalFolder })
    return engine.startEngine().catch(e => {
      assert.equal(e.message, 'Missing Master Key')
    })
  })

  it('Make Engine', function () {
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

  it('Get BlockHeight', function (done) {
    this.timeout(10000)
    request.get('https://blockchain.info/q/getblockcount', (err, res, body) => {
      assert(!err, 'getting block height from a second source')
      emitter.once('onBlockHeightChange', height => {
        assert(height >= body, 'Block height')
        done()
      })
      engine.startEngine()
    })
  })
})
