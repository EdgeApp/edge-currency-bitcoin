/* global describe it */
let BitcoinPlugin = require('../lib/index.js').BitcoinPlugin
let assert = require('assert')
let disklet = require('disklet')
let Emitter = require('events').EventEmitter
let request = require('request')
let _ = require('lodash')

let plugin, keys, engine
var emitter = new Emitter()
let walletLocalFolder = disklet.makeMemoryFolder()

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

describe('Engine Creation Errors', function () {
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

  it('Error when Making Engine without bitcoin key', function () {
    let wrongKeys = { bitcoinXpub: keys.pub }
    let engine = plugin.makeEngine({type: 'wallet:bitcoin', keys: wrongKeys}, { callbacks, walletLocalFolder })
    return engine.startEngine().catch(e => {
      assert.equal(e.message, 'Missing Master Key')
    })
  })
})

describe('Start Engine', function () {
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
    let end = _.after(2, done)
    request.get('https://blockchain.info/q/getblockcount', (err, res, body) => {
      assert(!err, 'getting block height from a second source')
      emitter.once('onBlockHeightChange', height => {
        assert(height >= body, 'Block height')
        assert(engine.getBlockHeight() >= body, 'Block height')
        end() // Can be "done" since the promise resolves before the event fires but just be on the safe side
      })
      engine.startEngine().then(a => {
        assert.equal(engine.getBlockHeight(), 0, 'Shoud init as 0')
        end()
      })
    })
  })
})

describe('Is Address Used', function () {
  it('Checking an empty address', function (done) {
    assert.equal(engine.isAddressUsed('133oNy5fHMZxwwgyCsovLenTSNTrksEyzd'), false)
    done()
  })

  it('Checking a wrong formated address', function (done) {
    try {
      engine.isAddressUsed('TestErrorWithWrongAddress')
    } catch (e) {
      assert(e, 'Should throw')
      assert.equal(e.message, 'Wrong formatted address')
      done()
    }
  })

  it('Checking an address we don\'t own', function () {
    try {
      assert.equal(engine.isAddressUsed('1F1xcRt8H8Wa623KqmkEontwAAVqDSAWCV'), false)
    } catch (e) {
      assert(e, 'Should throw')
      assert.equal(e.message, 'Address not found in wallet')
    }
  })

  // This test uses private API's to run so it might break if implementation changes even if API remains the same
  it('Check and address that has history', function (done) {
    this.timeout(0)
    let address = '1F1xcRt8H8Wa623KqmkEontwAAVqDSAWCV'
    engine.pushAddress(address)
    setTimeout(() => {
      // console.log('engine.txIndex', engine.txIndex)
      // console.log('engine.addresses', engine.addresses)
      assert.notEqual(engine.addresses.indexOf(address), -1, 'Should insert address to list of addresses')
      assert.equal(engine.isAddressUsed('1F1xcRt8H8Wa623KqmkEontwAAVqDSAWCV'), true, 'This address is a used 3rd party address')
      done()
    }, 10000)
  })
})
