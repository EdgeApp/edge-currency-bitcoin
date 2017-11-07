/* global describe it */
const LitecoinCurrencyPluginFactory = require('../../../lib/index.test.js').LitecoinCurrencyPluginFactory
const assert = require('assert')
const disklet = require('disklet')
const Emitter = require('events').EventEmitter
const request = require('request')
const cs = require('coinstring')
const jsonfile = require('jsonfile')
const path = require('path')

const DATA_STORE_FOLDER = 'txEngineFolderLTC'
const DATA_STORE_FILE = 'walletLocalDataLitecoinV1.json'
const TRANSACTION_STORE_FILE = 'transactionsLitecoinV1.json'
const TRANSACTION_ID_STORE_FILE = 'transactionsIdsLitecoinV1.json'
const dummyWalletData = path.join(__dirname, './dummyWalletData.json')
const dummyTransactions = path.join(__dirname, './dummyTransactions.json')
const dummyTransactionsIds = path.join(__dirname, './dummyTransactionsIds.json')

let plugin, keys, engine
var emitter = new Emitter()
let walletLocalFolder = disklet.makeMemoryFolder()
const WALLET_TYPE = 'wallet:litecoin44segwit'

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
    return LitecoinCurrencyPluginFactory.makePlugin(opts).then((litecoinPlugin) => {
      assert.equal(litecoinPlugin.currencyInfo.currencyCode, 'LTC')
      plugin = litecoinPlugin
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

  it('Error when Making Engine without litecoin key', function () {
    return plugin.makeEngine({type: WALLET_TYPE, keys: { litecoinXpub: keys.pub }}, { callbacks, walletLocalFolder })
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
    .then(() => LitecoinCurrencyPluginFactory.makePlugin(opts))
    .then((litecoinPlugin) => {
      assert.equal(litecoinPlugin.currencyInfo.currencyCode, 'LTC')
      plugin = litecoinPlugin
      keys = plugin.createPrivateKey(WALLET_TYPE)
      keys = plugin.derivePublicKey({type: WALLET_TYPE, keys})
    })
    .then(done)
  })

  it('Make Engine', function () {
    // console.log(walletLocalFolder)
    return plugin.makeEngine({type: WALLET_TYPE, keys}, {
      callbacks,
      walletLocalFolder
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
    emitter.once('onBlockHeightChange', () => {
      assert(engine.getBlockHeight() > 1289522, 'Block height should be bigger then 1289522')
      done()
    })
    engine.startEngine()
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
    assert.equal(engine.isAddressUsed('LLJKXmN7iSJq1iV2GptFHzdhpu9nyYKxqq'), false)
    done()
  })

  // it('Checking a non empty address from cache', function (done) {
  //   assert.equal(engine.isAddressUsed('mnAoeMHqeu8rKwQmuBykxYLnJysNjGjD2F'), true)
  //   done()
  // })

  // it('Checking a non empty address from network', function (done) {
  //   this.timeout(20000)
  //   setTimeout(() => {
  //     assert.equal(engine.isAddressUsed('mnXSnPVpkfzjHFd7JQFKaSC5bZYsGz2PxX'), true)
  //     done()
  //   }, 5000)
  // })
})

describe(`Get Fresh Address for Wallet type ${WALLET_TYPE}`, function () {
  it('Should provide a non used LTC address when no options are provided', function (done) {
    setTimeout(() => {
      let { publicAddress } = engine.getFreshAddress()
      assert(cs.createValidator(0x30)(publicAddress), 'Should be a valid address')
      request.get(`https://api.blockcypher.com/v1/ltc/main/addrs/${publicAddress}`, (err, res, body) => {
        const thirdPartyBalance = parseInt(JSON.parse(body).balance)
        assert(!err, 'getting address incoming txs from a second source')
        assert(thirdPartyBalance === 0, 'Should have never received coins')
        done()
      })
    }, 1000)
  })
})

let templateSpend = {
  networkFeeOption: 0,
  metadata: {
    name: 'Transfer to College Fund',
    category: 'Transfer:Wallet:College Fund'
  },
  spendTargets: [
    {
      currencyCode: 'LTC',
      publicAddress: 'tb1qcj0rm7famazgjuuv6jtu099dqxvxqr4wpc8xac',
      nativeAmount: '2100000' // 0.021 LTC
    },
    {
      currencyCode: 'LTC',
      publicAddress: 'tb1qm4cl4e7z23q7a3ujy5p5jy6d689nc7whl50a7s',
      nativeAmount: '4200000' // 0.042 LTC
    },
    {
      currencyCode: 'LTC',
      publicAddress: 'tb1qu0m8wrdv8sny8dhh2u3zhn8u3rn44k02fzutfy',
      nativeAmount: '1100000' // 0.011 LTC
    },
    {
      currencyCode: 'LTC',
      publicAddress: 'tb1q7fsqlglfpu5j3lny5r98ql93twvqrdtyczp9u0',
      nativeAmount: '500000' // 0.005 LTC
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
      return engine.signTx(a)
    }).catch(e => assert(e.message === 'InsufficientFundsError'))
  })

  it('Should build transaction with standard fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'standard' })).then(a => {
      return engine.signTx(a)
    }).catch(e => assert(e.message === 'InsufficientFundsError'))
  })

  it('Should build transaction with high fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'high' })).then(a => {
      return engine.signTx(a)
    }).catch(e => assert(e.message === 'InsufficientFundsError'))
  })

  it('Should build transaction with custom fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, {
      networkFeeOption: 'custom',
      customNetworkFee: '1000'
    })).then(a => {
      return engine.signTx(a)
    }).catch(e => assert(e.message === 'InsufficientFundsError'))
  })
})
