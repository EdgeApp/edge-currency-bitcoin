/* global describe it */
const BitcoinPlugin = require('../lib/index.js').BitcoinPlugin
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
    console.log('onAddressesCheck', progressRatio)
    emitter.emit('onAddressesCheck', progressRatio)
  },
  onBalanceChanged (currencyCode, balance) {
    console.log('onBalanceChange:', currencyCode, balance)
    emitter.emit('onBalanceChange', currencyCode, balance)
  },
  onBlockHeightChanged (height) {
    console.log('onBlockHeightChange:', height)
    emitter.emit('onBlockHeightChange', height)
  },
  onNewTransactions (transactionList) {
    console.log('onNewTransactions:', transactionList)
    emitter.emit('onNewTransactions', transactionList)
  },
  onTransactionsChanged (transactionList) {
    console.log('onTransactionsChanged:', transactionList)
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
    this.timeout(15000)
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
    this.timeout(10000)
    setTimeout(() => {
      assert.equal(engine.isAddressUsed('mfgNKSNq8375GLZ7uhBJPvzpZxKtL9HUb9'), true)
      done()
    }, 5000)
  })

  // // This test uses private API's to run so it might break if implementation changes even if API remains the same
  // it('Check and address that has history', function (done) {
  //   this.timeout(0)
  //   let address = '1F1xcRt8H8Wa623KqmkEontwAAVqDSAWCV'
  //   engine.pushAddress(address)
  //   setTimeout(() => {
  //     // console.log('engine.txIndex', engine.txIndex)
  //     // console.log('engine.addresses', engine.addresses)
  //     assert.notEqual(engine.addresses.indexOf(address), -1, 'Should insert address to list of addresses')
  //     assert.equal(engine.isAddressUsed('1F1xcRt8H8Wa623KqmkEontwAAVqDSAWCV'), true, 'This address is a used 3rd party address')
  //     done()
  //   }, 10000)
  // })
})

describe('Get Fresh Address', function () {
  this.timeout(15000)
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
// 1EtvppUprouJtMvZKiyHjLET6Q4cTYdQr9
// 18htdQXrB6W1TizbcDZhZ9DCSgaqvAdZNP
// 138P22UGHxa9dUTNwpw4Fhy11T8GJP3iTq
// 16kj94dkSn7hsqZ51KLw5Cjjm133dx5Zk6
// 14jG6D1eKj9rsi1yFrwwyRitqf7nriHi5R
// 19eCBq4WaE8etkE5s4KHqGu9LSJfbUfRFM
// 1Gfx7qZLJRwzmwQwnJRWKS3kiktti7Wt9B
// 19KgMxuJyhoFAmCFTc8RVbxAy3QhXd61Fz
// 1HcQWTTfWEBkfPZY1FxiqkfxajWGLCr1Zr

// let templateSpend = {
//   networkFeeOption: 0,
//   metadata: {
//     name: 'Transfer to College Fund',
//     category: 'Transfer:Wallet:College Fund'
//   },
//   spendTargets: [
//     {
//       currencyCode: 'BTC',
//       publicAddress: '1EtvppUprouJtMvZKiyHjLET6Q4cTYdQr9',
//       nativeAmount: '210000000' // 2.1 BTC
//     },
//     {
//       currencyCode: 'BTC',
//       publicAddress: '18htdQXrB6W1TizbcDZhZ9DCSgaqvAdZNP',
//       nativeAmount: '210000000' // 2.1 BTC
//     },
//     {
//       currencyCode: 'BTC',
//       publicAddress: '138P22UGHxa9dUTNwpw4Fhy11T8GJP3iTq',
//       nativeAmount: '210000000' // 2.1 BTC
//     },
//     {
//       currencyCode: 'BTC',
//       publicAddress: '14jG6D1eKj9rsi1yFrwwyRitqf7nriHi5R',
//       nativeAmount: '210000000' // 2.1 BTC
//     }
//   ]
// }

// describe('Make Spend', function () {
//   it('Should fail since no spend target is given', function (done) {
//     let abcSpendInfo = {
//       networkFeeOption: 'high',
//       metadata: {
//         name: 'Transfer to College Fund',
//         category: 'Transfer:Wallet:College Fund'
//       }
//     }
//     engine.makeSpend(abcSpendInfo).then(a => {
//       // console.log(a)
//       done()
//     }).catch(a => console.log('error', a))
//   })

//   it('Should transaction build with low fee', function (done) {
//     engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'low' })).then(a => {
//       // console.log(a)
//       done()
//     }).catch(a => console.log('error', a))
//   })

//   it('Should transaction build with standard fee', function (done) {
//     engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'standard' })).then(a => {
//       // console.log(a)
//       done()
//     }).catch(a => console.log('error', a))
//   })

//   it('Should transaction build with high fee', function (done) {
//     engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'high' })).then(a => {
//       // console.log(a)
//       done()
//     }).catch(a => console.log('error', a))
//   })

//   it('Should transaction build with custom fee', function (done) {
//     engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'custom', customNetworkFee: '10000' })).then(a => {
//       // console.log(a)
//       done()
//     }).catch(a => console.log('error', a))
//   })
// })
