/* global describe it */
const BitcoinPlugin = require('../lib/index.test.js').BitcoinPlugin
const assert = require('assert')
const disklet = require('disklet')
const Emitter = require('events').EventEmitter
const request = require('request')
const _ = require('lodash')
const cs = require('coinstring')

let plugin, keys, engine
var emitter = new Emitter()
let walletLocalFolder = disklet.makeMemoryFolder()
const WALLET_TYPE = 'wallet:testnet'

let opts = {
  io: {
    fetch: require('node-fetch'),
    random: (size) => Array(size).fill(0).map((x, i) => i),
    net: require('net')
  }
}

let callbacks = {
  onAddressesChecked (progressRatio) {
    // console.log('onAddressesCheck', progressRatio)
    emitter.emit('onAddressesCheck', progressRatio)
  },
  onBalanceChanged (currencyCode, balance) {
    // console.log('onBalanceChange:', currencyCode, balance)
    emitter.emit('onBalanceChange', currencyCode, balance)
  },
  onBlockHeightChanged (height) {
    // console.log('onBlockHeightChange:', height)
    emitter.emit('onBlockHeightChange', height)
  },
  onNewTransactions (transactionList) {
    // console.log('onNewTransactions:', transactionList)
    emitter.emit('onNewTransactions', transactionList)
  },
  onTransactionsChanged (transactionList) {
    // console.log('onTransactionsChanged:', transactionList)
    emitter.emit('onTransactionsChanged', transactionList)
  }
}

describe('Engine Creation Errors', function () {
  before('Plugin', function (done) {
    BitcoinPlugin.makePlugin(opts).then((bitcoinPlugin) => {
      assert.equal(bitcoinPlugin.currencyInfo.currencyCode, 'BTC')
      plugin = bitcoinPlugin
      keys = plugin.createPrivateKey(WALLET_TYPE)
      keys = plugin.derivePublicKey({type: WALLET_TYPE, keys: {bitcoinKey: keys.bitcoinKey}})
      done()
    })
  })

  it('Error when Making Engine without local folder', function () {
    let engine = plugin.makeEngine({type: WALLET_TYPE, keys}, { callbacks })
    return engine.startEngine().catch(e => {
      assert.equal(e.message, 'Cannot read property \'folder\' of undefined')
    })
  })

  it('Error when Making Engine without keys', function () {
    let engine = plugin.makeEngine({type: WALLET_TYPE}, { callbacks, walletLocalFolder })
    return engine.startEngine().catch(e => {
      assert.equal(e.message, 'Missing Master Key')
    })
  })

  it('Error when Making Engine without bitcoin key', function () {
    let wrongKeys = { bitcoinXpub: keys.pub }
    let engine = plugin.makeEngine({type: WALLET_TYPE, keys: wrongKeys}, { callbacks, walletLocalFolder })
    return engine.startEngine().catch(e => {
      assert.equal(e.message, 'Missing Master Key')
    })
  })
})

describe('Start Engine', function () {
  it('Make Engine', function () {
    engine = plugin.makeEngine({type: WALLET_TYPE, keys}, {
      callbacks,
      walletLocalFolder,
      optionalSettings: {
        electrumServers: [
          ['testnetnode.arihanc.com', '51001'],
          ['testnet.hsmiths.com', '53012'],
          ['hsmithsxurybd7uh.onion', '53011']
        ]
      }
    })
    assert.equal(typeof engine.startEngine, 'function', 'startEngine')
    assert.equal(typeof engine.killEngine, 'function', 'killEngine')
    // assert.equal(typeof engine.enableTokens, 'function', 'enableTokens')
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
    request.get('http://tbtc.blockr.io/api/v1/block/info/last', (err, res, body) => {
      assert(!err, 'getting block height from a second source')
      emitter.once('onBlockHeightChange', height => {
        const thirdPartyHeight = parseInt(JSON.parse(body).data.nb)
        assert(height >= thirdPartyHeight, 'Block height')
        assert(engine.getBlockHeight() >= thirdPartyHeight, 'Block height')
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
      assert.equal(engine.isAddressUsed('mnSmvy2q4dFNKQF18EBsrZrS7WEy6CieEE'), false)
    } catch (e) {
      assert(e, 'Should throw')
      assert.equal(e.message, 'Address not found in wallet')
    }
  })

  it('Checking an empty address', function (done) {
    assert.equal(engine.isAddressUsed('mpWoyhXKB9s1E7EyKdoGMR5cxvQNym6PiN'), false)
    done()
  })

  it('Checking a non empty address', function (done) {
    this.timeout(20000)
    setTimeout(() => {
      assert.equal(engine.isAddressUsed('mfgNKSNq8375GLZ7uhBJPvzpZxKtL9HUb9'), true)
      done()
    }, 5000)
  })
})

describe('Get Fresh Address', function () {
  this.timeout(20000)
  it('Should provide a non used BTC address when no options are provided', function (done) {
    setTimeout(() => {
      let address = engine.getFreshAddress()
      assert(cs.createValidator(0x6F)(address), 'Should be a valid address')
      request.get('http://tbtc.blockr.io/api/v1/address/info/' + address, (err, res, body) => {
        const thirdPartyBalance = parseInt(JSON.parse(body).data.balance)
        assert(!err, 'getting address incoming txs from a second source')
        assert(thirdPartyBalance === 0, 'Should have never received coins')
        done()
      })
    }, 5000)
  })
})

// let abcSpendInfo = {
//   networkFeeOption: 'high',
//   metadata:  {
//     name: 'Transfer to College Fund',
//     category: 'Transfer:Wallet:College Fund',
//   },
//   spendTargets: [
//     {
//       destWallet,
//       nativeAmount: '210000000' // 2.1 BTC
//     },
//   ]
// }

let templateSpend = {
  networkFeeOption: 0,
  metadata: {
    name: 'Transfer to College Fund',
    category: 'Transfer:Wallet:College Fund'
  },
  spendTargets: [
    {
      currencyCode: 'BTC',
      publicAddress: 'mfgNKSNq8375GLZ7uhBJPvzpZxKtL9HUb9',
      nativeAmount: '2100000' // 0.021 BTC
    },
    {
      currencyCode: 'BTC',
      publicAddress: 'mg2ic79wfpvH7oy8tUrfVjxbZ85weJbp2Q',
      nativeAmount: '4200000' // 0.042 BTC
    },
    {
      currencyCode: 'BTC',
      publicAddress: 'mhk239abov7CnL85PU5u3hD5HXahPuCMDX',
      nativeAmount: '1100000' // 0.011 BTC
    },
    {
      currencyCode: 'BTC',
      publicAddress: 'mjmA4sTWKVFpRtsFPY53MtyGVhUKahRT9L',
      nativeAmount: '500000' // 0.005 BTC
    }
  ]
}

describe('Make Spend', function () {
  it('Should fail since no spend target is given', function () {
    let abcSpendInfo = {
      networkFeeOption: 'high',
      metadata: {
        name: 'Transfer to College Fund',
        category: 'Transfer:Wallet:College Fund'
      }
    }
    return engine.makeSpend(abcSpendInfo).catch(e => {
      assert(e, 'Should throw')
      assert(e.message === 'Need to provide Spend Targets')
    })
  })

  it('Should build transaction with low fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'low' })).then(a => {
      console.log('success', a)
    }).catch(a => console.log('error', a))
  })

  it('Should build transaction with standard fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'standard' })).then(a => {
      console.log('success', a)
    }).catch(a => console.log('error', a))
  })

  it('Should build transaction with high fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'high' })).then(a => {
      console.log('success', a)
    }).catch(a => console.log('error', a))
  })

  it('Should build transaction with custom fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, {
      networkFeeOption: 'custom',
      customNetworkFee: '10000'
    })).then(a => {
      console.log('success', a)
    }).catch(a => console.log('error', a))
  })
})
