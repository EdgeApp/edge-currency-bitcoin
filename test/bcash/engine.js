/* global describe it */
const BitcoincashCurrencyPluginFactory = require('../../lib/index.test.js').BitcoincashCurrencyPluginFactory
const assert = require('assert')
const disklet = require('disklet')
const Emitter = require('events').EventEmitter

const DATA_STORE_FOLDER = 'txEngineFolderBCH'
const DATA_STORE_FILE = 'walletLocalDataV4.json'
const TRANSACTION_STORE_FILE = 'transactionsV1.json'
const TRANSACTION_ID_STORE_FILE = 'transactionsIdsV1.json'
const MEMORY_DUMP_STORE_FILE = 'dummyMemoryDumpV1.json'

let plugin, keys, engine
var emitter = new Emitter()
let walletLocalFolder = disklet.makeMemoryFolder()
const WALLET_TYPE = 'wallet:bitcoincash44'

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
    return BitcoincashCurrencyPluginFactory.makePlugin(opts).then((BcashPlugin) => {
      assert.equal(BcashPlugin.currencyInfo.currencyCode, 'BCH')
      plugin = BcashPlugin
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

  it('Error when Making Engine without Bcash key', function () {
    return plugin.makeEngine({type: WALLET_TYPE, keys: { bcashXpub: keys.pub }}, { callbacks, walletLocalFolder })
    .catch(e => {
      assert.equal(e.message, 'Missing Master Key')
    })
  })
})

describe(`Start Engine for Wallet type ${WALLET_TYPE}`, function () {
  before('Create local cache file', function (done) {
    walletLocalFolder
    .folder(DATA_STORE_FOLDER)
    .file(DATA_STORE_FILE)
    .setText(JSON.stringify({}))
    .then(() => walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(TRANSACTION_STORE_FILE)
      .setText(JSON.stringify({}))
    )
    .then(() => walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(TRANSACTION_ID_STORE_FILE)
      .setText(JSON.stringify({}))
    ).then(() => walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(MEMORY_DUMP_STORE_FILE)
      .setText(JSON.stringify({}))
    )
    .then(() => BitcoincashCurrencyPluginFactory.makePlugin(opts))
    .then((BcashPlugin) => {
      assert.equal(BcashPlugin.currencyInfo.currencyCode, 'BCH')
      plugin = BcashPlugin
      keys = plugin.createPrivateKey(WALLET_TYPE)
      keys = plugin.derivePublicKey({type: WALLET_TYPE, keys})
    })
    .then(done)
  })

  it('Make Engine', function () {
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
    engine.startEngine().then(a => {
      assert(engine.getBlockHeight() > 493028, 'Block height should be bigger then 493028')
      done()
    })
    .catch(e => console.log(e))
  })
})

describe(`Is Address Used for Wallet type ${WALLET_TYPE}`, function () {
  it('Checking a wrong formated address', function (done) {
    try {
      engine.isAddressUsed('18cBEMRxXHqzWWCxZNtF91F5sbUNKhL5PX')
    } catch (e) {
      assert(e, 'Should throw')
      assert.equal(e.message, 'Wrong formatted address')
      done()
    }
  })

  it('Checking an address we don\'t own', function () {
    try {
      assert.equal(engine.isAddressUsed('18cBEMRxXHqzWWCxZNtU91F5sbUNKhL5PX'), false)
    } catch (e) {
      assert(e, 'Should throw')
      assert.equal(e.message, 'Address not found in wallet')
    }
  })

  it('Checking an empty address', function (done) {
    assert.equal(engine.isAddressUsed('12WmE6VpqUqDxgW3GEqaPU8zTSHYcAJhcR'), false)
    done()
  })

  // it('Checking a non empty address from network', function (done) {
  //   this.timeout(20000)
  //   setTimeout(() => {
  //     assert.equal(engine.isAddressUsed('12Etsmqp76ToVNfBZbfwMmhixqc19J7X8g'), true)
  //     done()
  //   }, 5000)
  // })
})

// describe(`Get Fresh Address for Wallet type ${WALLET_TYPE}`, function () {
//   this.timeout(20000)
//   it('Should provide a non used BCH address when no options are provided', function (done) {
//     setTimeout(() => {
//       let address = engine.getFreshAddress()
//       assert(cs.createValidator(0x6F)(address), 'Should be a valid address')
//       request.get(`https://api.blocktrail.com/v1/tBCH/address/${address}?api_key=MY_APIKEY`, (err, res, body) => {
//         const thirdPartyBalance = parseInt(JSON.parse(body).received)
//         assert(!err, 'getting address incoming txs from a second source')
//         assert(thirdPartyBalance === 0, 'Should have never received coins')
//         done()
//       })
//     }, 5000)
//   })
// })

let templateSpend = {
  networkFeeOption: 0,
  metadata: {
    name: 'Transfer to College Fund',
    category: 'Transfer:Wallet:College Fund'
  },
  spendTargets: [
    {
      currencyCode: 'BCH',
      publicAddress: '1P9DhH2Xctb1rzvYuFULBad9EUMCshj5PN',
      nativeAmount: '2100000' // 0.021 BCH
    },
    {
      currencyCode: 'BCH',
      publicAddress: '1PCHtBN2ijhTzjaJQBfFFTbowawBUH5hZQ',
      nativeAmount: '4200000' // 0.042 BCH
    },
    {
      currencyCode: 'BCH',
      publicAddress: '1PdN48zwRkJPcW6PV67UcVLxDoejSuRCF6',
      nativeAmount: '1100000' // 0.011 BCH
    },
    {
      currencyCode: 'BCH',
      publicAddress: '1PpaSw3zJsc3i7tm3qb1jfgFDb8LJn1oF9',
      nativeAmount: '500000' // 0.005 BCH
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
    .catch(a => {
      // console.log('error', a)
    })
  })

  it('Should build transaction with standard fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'standard' })).then(a => {
      // console.log('makeSpend', a)
      return engine.signTx(a)
    })
    .then(a => {
      // console.log('sign', a)
    })
    .catch(a => {
      // console.log('error', a)
    })
  })

  it('Should build transaction with high fee', function () {
    return engine.makeSpend(Object.assign(templateSpend, { networkFeeOption: 'high' })).then(a => {
      // console.log('makeSpend', a)
      return engine.signTx(a)
    })
    .then(a => {
      // console.log('sign', a)
    })
    .catch(a => {
      // console.log('error', a)
    })
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
    .catch(a => {
      // console.log('error', a)
    })
  })
})
