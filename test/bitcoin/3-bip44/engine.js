/* global describe it */
const BitcoinCurrencyPluginFactory = require('../../../lib/index.test.js').BitcoinCurrencyPluginFactory
const assert = require('assert')
const disklet = require('disklet')
const Emitter = require('events').EventEmitter
const request = require('request')
const cs = require('coinstring')
const jsonfile = require('jsonfile')
const path = require('path')

const DATA_STORE_FOLDER = 'txEngineFolderBTC'
const DATA_STORE_FILE = 'walletLocalDataV4.json'
const TRANSACTION_STORE_FILE = 'transactionsV1.json'
const TRANSACTION_ID_STORE_FILE = 'transactionsIdsV1.json'
const MEMORY_DUMP_STORE_FILE = 'dummyMemoryDumpV1.json'
const dummyWalletData = path.join(__dirname, './dummyWalletData.json')
const dummyTransactions = path.join(__dirname, './dummyTransactions.json')
const dummyTransactionsIds = path.join(__dirname, './dummyTransactionsIds.json')
const dummyMemoryDump = path.join(__dirname, './dummyMemoryDump.json')

let plugin, keys, engine
var emitter = new Emitter()
let walletLocalFolder = disklet.makeMemoryFolder()
const WALLET_TYPE = 'wallet:testnet44'

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
  onTransactionsChanged (transactionList) {
    // console.log('onTransactionsChanged:', transactionList)
    emitter.emit('onTransactionsChanged', transactionList)
  }
}

describe(`Engine Creation Errors for Wallet type ${WALLET_TYPE}`, function () {
  let keys, plugin
  before('Plugin', function () {
    return BitcoinCurrencyPluginFactory.makePlugin(opts).then((bitcoinPlugin) => {
      assert.equal(bitcoinPlugin.currencyInfo.currencyCode, 'BTC')
      plugin = bitcoinPlugin
      keys = plugin.createPrivateKey(WALLET_TYPE)
      keys = plugin.derivePublicKey({type: WALLET_TYPE, keys})
    })
  })

  it('Error when Making Engine without local folder', function () {
    return plugin.makeEngine({type: WALLET_TYPE, keys}, { callbacks })
    .catch(e => {
      assert.equal(e.message, 'Cannot create and engine without a local folder')
    })
  })

  it('Error when Making Engine without keys', function () {
    return plugin.makeEngine({type: WALLET_TYPE}, { callbacks, walletLocalFolder })
    .catch(e => {
      assert.equal(e.message, 'Missing Master Key')
    })
  })

  it('Error when Making Engine without bitcoin key', function () {
    return plugin.makeEngine({type: WALLET_TYPE, keys: { bitcoinXpub: keys.pub }}, { callbacks, walletLocalFolder })
    .catch(e => {
      assert.equal(e.message, 'Missing Master Key')
    })
  })
})

describe(`Start Engine for Wallet type ${WALLET_TYPE}`, function () {
  before('Create local cache file', function (done) {
    let walletData = jsonfile.readFileSync(dummyWalletData)
    let transactions = jsonfile.readFileSync(dummyTransactions)
    let transactionsIds = jsonfile.readFileSync(dummyTransactionsIds)
    let memoryDump = jsonfile.readFileSync(dummyMemoryDump)
    walletLocalFolder
    .folder(DATA_STORE_FOLDER)
    .file(DATA_STORE_FILE)
    .setText(JSON.stringify(walletData))
    .then(() => walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(TRANSACTION_STORE_FILE)
      .setText(JSON.stringify(transactions))
    )
    .then(() => walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(TRANSACTION_ID_STORE_FILE)
      .setText(JSON.stringify(transactionsIds))
    )
    .then(() => walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(MEMORY_DUMP_STORE_FILE)
      .setText(JSON.stringify(memoryDump))
    )
    .then(() => BitcoinCurrencyPluginFactory.makePlugin(opts))
    .then((bitcoinPlugin) => {
      assert.equal(bitcoinPlugin.currencyInfo.currencyCode, 'BTC')
      plugin = bitcoinPlugin
      keys = plugin.createPrivateKey(WALLET_TYPE)
      keys = plugin.derivePublicKey({type: WALLET_TYPE, keys})
    })
    .then(done)
  })

  it('Make Engine', function () {
    return plugin.makeEngine({type: WALLET_TYPE, keys}, {
      callbacks,
      walletLocalFolder,
      optionalSettings: {
        enableOverrideServers: true,
        electrumServers: [
          ['testnetnode.arihanc.com', '51001']
        ]
      }
    }).then(e => {
      engine = e
      assert.equal(typeof engine.startEngine, 'function', 'startEngine')
      assert.equal(typeof engine.killEngine, 'function', 'killEngine')
      // assert.equal(typeof engine.enableTokens, 'function', 'enableTokens')
      assert.equal(typeof engine.getBlockHeight, 'function', 'getBlockHeight')
      assert.equal(typeof engine.getBalance, 'function', 'getBalance')
      assert.equal(typeof engine.getNumTransactions, 'function', 'getNumTransactions')
      assert.equal(typeof engine.getTransactions, 'function', 'getTransactions')
      assert.equal(typeof engine.getFreshAddress, 'function', 'getFreshAddress')
      assert.equal(typeof engine.addGapLimitAddresses, 'function', 'addGapLimitAddresses')
      assert.equal(typeof engine.isAddressUsed, 'function', 'isAddressUsed')
      assert.equal(typeof engine.makeSpend, 'function', 'makeSpend')
      assert.equal(typeof engine.signTx, 'function', 'signTx')
      assert.equal(typeof engine.broadcastTx, 'function', 'broadcastTx')
      assert.equal(typeof engine.saveTx, 'function', 'saveTx')
      return true
    })
    .catch(e => console.log(e))
  })

  it('Get BlockHeight', function (done) {
    this.timeout(10000)
    request.get('https://api.blocktrail.com/v1/tBTC/block/latest?api_key=MY_APIKEY', (err, res, body) => {
      assert(!err, 'getting block height from a second source')
      emitter.once('onBlockHeightChange', height => {
        const thirdPartyHeight = parseInt(JSON.parse(body).height)
        assert(height >= thirdPartyHeight, 'Block height')
        assert(engine.getBlockHeight() >= thirdPartyHeight, 'Block height')
        done() // Can be "done" since the promise resolves before the event fires but just be on the safe side
      })
      engine.startEngine()
    })
  })
})

describe(`Is Address Used for Wallet type ${WALLET_TYPE}`, function () {
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
    assert.equal(engine.isAddressUsed('mr7tuzfNUpjdmwuKWJFC3PJ581YmHcbmS3'), false)
    done()
  })

  it('Checking a non empty address from cache', function (done) {
    assert.equal(engine.isAddressUsed('mnAoeMHqeu8rKwQmuBykxYLnJysNjGjD2F'), true)
    done()
  })

  it('Checking a non empty address from network', function (done) {
    setTimeout(() => {
      assert.equal(engine.isAddressUsed('mnXSnPVpkfzjHFd7JQFKaSC5bZYsGz2PxX'), true)
      done()
    }, 1000)
  })
})

describe(`Get Fresh Address for Wallet type ${WALLET_TYPE}`, function () {
  it('Should provide a non used BTC address when no options are provided', function (done) {
    setTimeout(() => {
      let { publicAddress } = engine.getFreshAddress()
      assert(cs.createValidator(0x6F)(publicAddress), 'Should be a valid address')
      request.get(`https://api.blocktrail.com/v1/tBTC/address/${publicAddress}?api_key=MY_APIKEY`, (err, res, body) => {
        const thirdPartyBalance = parseInt(JSON.parse(body).received)
        assert(!err, 'getting address incoming txs from a second source')
        assert(thirdPartyBalance === 0, 'Should have never received coins')
        done()
      })
    }, 1000)
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

describe(`Make Spend and Sign for Wallet type ${WALLET_TYPE}`, function () {
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
    })
  })

  it('Should build transaction with low fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'low' })).then(a => {
      // console.log('makeSpend', a)
      return engine.signTx(a)
    })
    .then(a => {
      // console.log('sign', a)
    })
    .catch(a => console.log('error', a))
  })

  it('Should build transaction with standard fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'standard' })).then(a => {
      // console.log('makeSpend', a)
      return engine.signTx(a)
    })
    .then(a => {
      // console.log('sign', a)
    })
    .catch(a => console.log('error', a))
  })

  it('Should build transaction with high fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'high' })).then(a => {
      // console.log('makeSpend', a)
      return engine.signTx(a)
    })
    .then(a => {
      // console.log('sign', a)
    })
    .catch(a => console.log('error', a))
  })

  it('Should build transaction with custom fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, {
      networkFeeOption: 'custom',
      customNetworkFee: '1000'
    })).then(a => {
      // console.log('makeSpend', a)
      return engine.signTx(a)
    })
    .then(a => {
      // console.log('sign', a)
    })
    .catch(a => console.log('error', a))
  })
})
