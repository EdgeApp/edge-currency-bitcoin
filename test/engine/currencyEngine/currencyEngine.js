// @flow
import EventEmitter from 'events'

import { makeFakeIos } from 'edge-core-js'
import { assert } from 'chai'
import { before, describe, it } from 'mocha'
import fetch from 'node-fetch'
import request from 'request'

import * as Factories from '../../../src/index.js'
import dummyAddressData from './dummyAddressData.json'
import dummyHeadersData from './dummyHeadersData.json'
import dummyTransactionsData from './dummyTransactionsData.json'
import fixtures from './fixtures.json'
import bcoin from 'bcoin'

const DATA_STORE_FOLDER = 'txEngineFolderBTC'

for (const fixture of fixtures) {
  const CurrencyPluginFactory = Factories[fixture['factory']]
  const WALLET_FORMAT = fixture['WALLET_FORMAT']
  const WALLET_TYPE = fixture['WALLET_TYPE']
  const TX_AMOUNT = fixture['TX_AMOUNT']

  let plugin, keys, engine
  const emitter = new EventEmitter()
  const [fakeIo] = makeFakeIos(1)
  const walletLocalFolder = fakeIo.folder
  const opts = {
    io: Object.assign(fakeIo, {
      secp256k1: bcoin.crypto.secp256k1,
      pbkdf2: bcoin.crypto.pbkdf2,
      random: size => fixture['key'],
      Socket: require('net').Socket,
      TLSSocket: require('tls').TLSSocket,
      fetch: fetch
    })
  }

  const callbacks = {
    onAddressesChecked (progressRatio) {
      // console.log('onAddressesCheck', progressRatio)
      emitter.emit('onAddressesCheck', progressRatio)
    },
    onBalanceChanged (currencyCode, balance) {
      console.log('onBalanceChange:', currencyCode, balance)
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
    before('Plugin', function (done) {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        assert.equal(
          currencyPlugin.currencyInfo.currencyCode,
          fixture['Test Currency code']
        )
        plugin = currencyPlugin
        // Hack for now until we change all the dummy data to represent the new derivation path
        keys = Object.assign(plugin.createPrivateKey(WALLET_TYPE), {
          coinType: 0,
          format: WALLET_FORMAT
        })
        plugin.derivePublicKey({ type: WALLET_TYPE, keys }).then(result => {
          keys = result
          done()
        })
      })
    })

    it('Error when Making Engine without local folder', function () {
      return plugin
        .makeEngine({ type: WALLET_TYPE, keys }, { callbacks })
        .catch(e => {
          assert.equal(
            e.message,
            'Cannot create an engine without a local folder'
          )
        })
    })

    it('Error when Making Engine without keys', function () {
      return plugin
        .makeEngine({ type: WALLET_TYPE }, { callbacks, walletLocalFolder })
        .catch(e => {
          assert.equal(e.message, 'Missing Master Key')
        })
    })

    it('Error when Making Engine without bitcoin key', function () {
      return plugin
        .makeEngine(
          { type: WALLET_TYPE, keys: { bitcoinXpub: keys.pub } },
          { callbacks, walletLocalFolder }
        )
        .catch(e => {
          assert.equal(e.message, 'Missing Master Key')
        })
    })
  })
  describe(`Start Engine for Wallet type ${WALLET_TYPE}`, function () {
    before('Create local cache file', function (done) {
      walletLocalFolder
        .folder(DATA_STORE_FOLDER)
        .file('addresses.json')
        .setText(JSON.stringify(dummyAddressData))
        .then(() =>
          walletLocalFolder
            .folder(DATA_STORE_FOLDER)
            .file('txs.json')
            .setText(JSON.stringify(dummyTransactionsData))
        )
        .then(() =>
          walletLocalFolder
            .folder(DATA_STORE_FOLDER)
            .file('headers.json')
            .setText(JSON.stringify(dummyHeadersData))
        )
        .then(done)
    })

    it('Make Engine', function () {
      const { id, optionalSettings } = fixture['Make Engine']
      return plugin
        .makeEngine(
          { type: WALLET_TYPE, keys, id },
          {
            callbacks,
            walletLocalEncryptedFolder: walletLocalFolder.folder(DATA_STORE_FOLDER),
            walletLocalFolder: walletLocalFolder.folder(DATA_STORE_FOLDER),
            optionalSettings
          }
        )
        .then(e => {
          engine = e
          assert.equal(typeof engine.startEngine, 'function', 'startEngine')
          assert.equal(typeof engine.killEngine, 'function', 'killEngine')
          // assert.equal(typeof engine.enableTokens, 'function', 'enableTokens')
          assert.equal(
            typeof engine.getBlockHeight,
            'function',
            'getBlockHeight'
          )
          assert.equal(typeof engine.getBalance, 'function', 'getBalance')
          assert.equal(
            typeof engine.getNumTransactions,
            'function',
            'getNumTransactions'
          )
          assert.equal(
            typeof engine.getTransactions,
            'function',
            'getTransactions'
          )
          assert.equal(
            typeof engine.getFreshAddress,
            'function',
            'getFreshAddress'
          )
          assert.equal(
            typeof engine.addGapLimitAddresses,
            'function',
            'addGapLimitAddresses'
          )
          assert.equal(typeof engine.isAddressUsed, 'function', 'isAddressUsed')
          assert.equal(typeof engine.makeSpend, 'function', 'makeSpend')
          assert.equal(typeof engine.signTx, 'function', 'signTx')
          assert.equal(typeof engine.broadcastTx, 'function', 'broadcastTx')
          assert.equal(typeof engine.saveTx, 'function', 'saveTx')
          return true
        })
    })
  })

  describe(`Is Address Used for Wallet type ${WALLET_TYPE} from cache`, function () {
    const testCases = fixture['Address used from cache']
    const wrongFormat = testCases.wrongFormat || []
    const notInWallet = testCases.notInWallet || []
    const empty = testCases.empty || {}
    const nonEmpty = testCases.nonEmpty || {}

    wrongFormat.forEach(address => {
      it('Checking a wrong formated address', function (done) {
        try {
          engine.isAddressUsed(address)
        } catch (e) {
          assert(e, 'Should throw')
          assert.equal(e.message, 'Wrong formatted address')
          done()
        }
      })
    })

    notInWallet.forEach(address => {
      it("Checking an address we don't own", function () {
        try {
          assert.equal(engine.isAddressUsed(address), false)
        } catch (e) {
          assert(e, 'Should throw')
          assert.equal(e.message, 'Address not found in wallet')
        }
      })
    })

    Object.keys(empty).forEach(test => {
      it(`Checking an empty ${test}`, function (done) {
        assert.equal(engine.isAddressUsed(empty[test]), false)
        done()
      })
    })

    Object.keys(nonEmpty).forEach(test => {
      it(`Checking a non empty ${test}`, function (done) {
        assert.equal(engine.isAddressUsed(nonEmpty[test]), true)
        done()
      })
    })
  })

  describe(`Get Transactions from Wallet type ${WALLET_TYPE}`, function () {
    it('Should get number of transactions from cache', function (done) {
      assert.equal(
        engine.getNumTransactions(),
        TX_AMOUNT,
        `should have ${TX_AMOUNT} tx from cache`
      )
      done()
    })

    it('Should get transactions from cache', function (done) {
      engine.getTransactions().then(txs => {
        assert.equal(
          txs.length,
          TX_AMOUNT,
          `should have ${TX_AMOUNT} tx from cache`
        )
        done()
      })
    })

    it('Should get transactions from cache with options', function (done) {
      engine.getTransactions({ startIndex: 1, numEntries: 2 }).then(txs => {
        assert.equal(txs.length, 2, 'should have 2 tx from cache')
        done()
      })
    })
  })

  describe('Should Add Gap Limit Addresses', function () {
    const gapAddresses = fixture['Add Gap Limit']
    const derived = gapAddresses.derived || []
    // const future = gapAddresses.future || []

    it('Add Empty Array', function (done) {
      engine.addGapLimitAddresses([])
      done()
    })

    it('Add Already Derived Addresses', function (done) {
      engine.addGapLimitAddresses(derived)
      done()
    })

    // it('Add Future Addresses', function (done) {
    //   engine.addGapLimitAddresses(future)
    //   done()
    // })
  })

  describe('Should start engine', function () {
    it('Get BlockHeight', function (done) {
      const { uri, defaultHeight } = fixture.BlockHeight
      this.timeout(10000)
      const testHeight = () => {
        emitter.on('onBlockHeightChange', height => {
          if (height >= heightExpected) {
            emitter.removeAllListeners('onBlockHeightChange')
            assert(engine.getBlockHeight() >= heightExpected, 'Block height')
            done() // Can be "done" since the promise resolves before the event fires but just be on the safe side
          }
        })
        engine.startEngine().catch(e => {
          console.log('startEngine error', e, e.message)
        })
      }
      let heightExpected = defaultHeight
      if (uri) {
        request.get(uri, (err, res, body) => {
          assert(!err, 'getting block height from a second source')
          const thirdPartyHeight = parseInt(JSON.parse(body).height)
          if (thirdPartyHeight && !isNaN(thirdPartyHeight)) {
            heightExpected = thirdPartyHeight
          }
          testHeight()
        })
      } else {
        testHeight()
      }
    })
  })

  describe(`Get Wallet Keys for Wallet type ${WALLET_TYPE}`, function () {
    it('get private key', function (done) {
      engine.getDisplayPrivateSeed()
      done()
    })
    it('get public key', function (done) {
      engine.getDisplayPublicSeed()
      done()
    })
  })

  // describe(`Is Address Used for Wallet type ${WALLET_TYPE} from network`, function () {
  //   it('Checking a non empty P2WSH address', function (done) {
  //     setTimeout(() => {
  //       assert.equal(engine.isAddressUsed('tb1qzsqz3akrp8745gsrl45pa2370gculzwx4qcf5v'), true)
  //       done()
  //     }, 1000)
  //   })

  //   it('Checking a non empty address P2SH', function (done) {
  //     setTimeout(() => {
  //       assert.equal(engine.isAddressUsed('2MtegHVwZFy88UjdHU81wWiRkwDq5o8pWka'), true)
  //       done()
  //     }, 1000)
  //   })
  // })

  describe(`Get Fresh Address for Wallet type ${WALLET_TYPE}`, function () {
    it('Should provide a non used BTC address when no options are provided', function (done) {
      this.timeout(10000)
      setTimeout(() => {
        const address = engine.getFreshAddress()
        request.get(
          `https://api.blocktrail.com/v1/tBTC/address/${
            address.publicAddress
          }?api_key=MY_APIKEY`,
          (err, res, body) => {
            let code = null
            try {
              code = parseInt(JSON.parse(body).code)
            } catch (e) {}
            if (!err && code && code !== 429) {
              const thirdPartyBalance = parseInt(JSON.parse(body).received)
              assert(!err, 'getting address incoming txs from a second source')
              assert(
                thirdPartyBalance === 0,
                'Should have never received coins'
              )
            } else {
              const scriptHash =
                engine.engineState.scriptHashes[address.publicAddress]
              const transactions =
                engine.engineState.addressInfos[scriptHash].txids
              assert(
                transactions.length === 0,
                'Should have never received coins'
              )
            }
            done()
          }
        )
      }, 2000)
    })
  })

  describe(`Make Spend and Sign for Wallet type ${WALLET_TYPE}`, function () {
    const spendTests = fixture.Spend || {}
    const insufficientTests = fixture.InsufficientFundsError || {}

    it('Should fail since no spend target is given', function () {
      const abcSpendInfo = {
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

    Object.keys(spendTests).forEach(test => {
      it(`Should build transaction with ${test}`, function () {
        this.timeout(10000)
        const templateSpend = spendTests[test]
        return engine
          .makeSpend(templateSpend)
          .then(a => {
            return engine.signTx(a)
          })
          .then(a => {
            // console.log('sign', a)
          })
      })
    })

    Object.keys(insufficientTests).forEach(test => {
      it(`Should throw InsufficientFundsError for ${test}`, function () {
        const templateSpend = insufficientTests[test]
        return engine
          .makeSpend(templateSpend)
          .catch(e => assert.equal(e.message, 'InsufficientFundsError'))
      })
    })
  })

  describe(`Sweep Keys and Sign for Wallet type ${WALLET_TYPE}`, function () {
    const sweepTests = fixture.Sweep || {}

    Object.keys(sweepTests).forEach(test => {
      it(`Should build transaction with ${test}`, function () {
        this.timeout(10000)
        const templateSpend = sweepTests[test]
        return engine
          .sweepPrivateKeys(templateSpend)
          .then(a => {
            return engine.signTx(a)
          })
          .then(a => {
            // console.warn('sign', a)
          })
      })
    })
  })

  describe(`Stop Engine for Wallet type ${WALLET_TYPE}`, function () {
    it('dump the wallet data', function (done) {
      const dataDump = engine.dumpData()
      const { id, network } = fixture['Make Engine']
      assert(dataDump.walletId === id, 'walletId')
      assert(dataDump.walletType === WALLET_TYPE, 'walletType')
      assert(dataDump.walletFormat === WALLET_FORMAT, 'walletFormat')
      assert(dataDump.pluginType === network, 'pluginType')
      done()
    })

    it('Stop the engine', function (done) {
      console.log('kill engine')
      engine.killEngine().then(done)
    })
  })
}
