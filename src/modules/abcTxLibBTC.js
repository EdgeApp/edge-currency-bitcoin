//Replacing native crypto modules for ReactNative
var masterCrypto = require('react-native-crypto')
var secp256k1 = require('react-native-secp256k1')

var crypto = masterCrypto

import {
  Electrum
} from "./electrum"

//including Bcoin Engine
var bcoin = require("../../vendor/bcoin.js")

var net = require('react-native-tcp')

import {
  ABCTransaction
} from "./abcTransaction"

import {
  txLibInfo
} from "./../txLibInfo.js"

var GAP_LIMIT = 10
var DATA_STORE_FOLDER = 'txEngineFolderBTC'
var DATA_STORE_FILE = 'walletLocalData.json'

var PRIMARY_CURRENCY = txLibInfo.getInfo.currencyCode
var TOKEN_CODES = [PRIMARY_CURRENCY].concat(txLibInfo.supportedTokens)

class ABCTxLibBTC {

  constructor(io, keyInfo, opts) {
    if (opts === void 0) opts = {}

    // dataStore.init(abcTxLibAccess, options, callbacks)
    var walletLocalFolder = opts.walletLocalFolder
    var callbacks = opts.callbacks

    this.io = io
    this.keyInfo = keyInfo
    this.abcTxLibCallbacks = callbacks
    this.walletLocalFolder = walletLocalFolder
    this.txIndex = []
    this.connections = []
    this.walletsScanQueue = []
    this.transactionsStash = []
    this.transactionHistory = {}
    this.transactionTS = {}
    this.increasingLimitLoop = 0
    this.watchAhead = 10
    this.addressLimitLoop = 0
    this.txUpdateTotalEntries = 0
    this.txUpdateStarted = false
    this.txUpdateTotalEntries = 0
    this.txUpdateFinished = false
    this.txUpdateBalanceUpdateStarted = false
    this.txBalanceUpdateTotal = 0
    this.addressHashMap = {}
    this.txBalanceUpdateProgress = 0
    this.txBalanceUpdateFinished = 0
    this.txUpdateMonitoring = {}
    this.hashUpdateMonitoring = {}
    this.engineOn = false
    this.transactionsDirty = true
    this.totalPercentageCombined = 0
    this.addressesChecked = false
    this.numAddressesChecked = 0
    this.numAddressesToCheck = 0
    this.walletLocalData = {}
    this.walletLocalDataDirty = false
    this.transactionsChangedArray = []
    this.masterBalance = 0
    this.electrumServers = [
      ["h.1209k.com", "50001"],
      ["electrum-bu-az-weuro.airbitz.co", "50001"],
      ["electrum-bc-az-eusa.airbitz.co", "50001"],
      ["electrum-bu-az-ausw.airbitz.co", "50001"],
      ["electrum.hsmiths.com", "8080"],
      ["e.anonyhost.org", "50001"],
      ["electrum.no-ip.org", "50001"],
      ["electrum-bu-az-wusa2.airbitz.co", "50001"],
      ["ELECTRUM.not.fyi", "50001"],
      ["electrum.jdubya.info", "50001"],
      ["electrum-bu-az-wjapan.airbitz.co", "50001"],
      ["kerzane.ddns.net", "50001"]
    ]
    this.globalRecievedData = ["", "", "", "", "", "", "", "", "", ""]
    this.addresses = []
    this.masterFee = 0
    this.masterFeeReuqested = 0
    this.masterFeeRecieved = 0
    this.baseUrl = ""
    this.electrum = new Electrum(this.electrumServers, this.incommingTransaction())

    // this.walletdb = new bcoin.walletdb({ db: 'leveldb', location: 'db/mywalletTest1' });
    this.walletdb = new bcoin.walletdb({
      db: 'memory'
    })

  }

  incommingTransaction() {
    var this$1 = this
    return function(wallet, hash) {
      this$1.processAddress(wallet, hash)
    }

  }

  engineLoop() {
    this.engineOn = true
    this.saveWalletDataStore()
  }

  isTokenEnabled(token) {
    return this.walletLocalData.enabledTokens.indexOf(token) !== -1
  }

  fetchGet(cmd, params) {
    return this.io.fetch(this.baseUrl + cmd + '/' + params, {
      method: 'GET'
    })
  }

  fetchPost(cmd, body) {
    return this.io.fetch(this.baseUrl + cmd, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify(body)
    })
  }


  updateTick() {

    var totalAddresses = this.txUpdateTotalEntries
    var executedAddresses = 0

    var totalTransactions = 0
    var executedTransactions = 0

    for (var i in this.txIndex) {
      if (!this.txIndex[i].executed)
        continue
      executedAddresses++
      for (var j in this.txIndex[i].txs) {
        totalTransactions++
        if (this.txIndex[i].txs[j].executed) {
          executedTransactions++
        }
      }
    }

    var addressProgress = executedAddresses / totalAddresses
    var transactionProgress = (totalTransactions > 0) ? executedTransactions / totalTransactions : 0

    var progress = [addressProgress, transactionProgress]

    console.log("Total TX List:", Object.keys(this.txIndex), "totalAddresses:", totalAddresses, "executedAddresses:", executedAddresses)

    var totalProgress = addressProgress * transactionProgress

    if (totalProgress == 1 && !this.txUpdateBalanceUpdateStarted) {
      this.txUpdateBalanceUpdateStarted = 1
      console.log("PROCESSING ELECTRUM")
      this.processElectrumData()
    }

    return totalProgress
  }

  pushAddress(address) {
    this.addresses.push(address)
    this.processAddress(address)
  }

  deriveAddresses(amount) {
    var this$1 = this
    for (var i = 1; i <= amount; i++) {
      // console.log("REQUESTING NEW ADDRESS")
      this.txUpdateTotalEntries++
        this.wallet.createKey(0).then(function(res) {
          var address = res.getAddress('base58check')
          if (this$1.addresses.indexOf(address) > -1) {
            // console.log("EXISTING ADDRESS ")
            this$1.txUpdateTotalEntries--
              return
          }
          // console.log("PUSHING NEW ADDRESS")
          this$1.pushAddress(address)
        })
    }
  }

  checkGapLimit(wallet) {
    var total = this.addresses.length
    var walletIndex = this.addresses.indexOf(wallet) + 1
    if (walletIndex + GAP_LIMIT > total) {
      this.deriveAddresses(walletIndex + GAP_LIMIT - total)
    }
  }

  processAddress(wallet, hash = -1) {
    if (typeof this.txIndex[wallet] == "object") {
      this.txIndex[wallet].hash = hash
    } else {
      this.txIndex[wallet] = {
        txs: {},
        executed: 0,
        transactionHash: hash
      }
    }

    function getCallback(tx, wallet) {
      return function(transaction) {
        if (typeof this$1.txIndex[wallet].txs[tx] == "undefined") {
          // console.log("BADTX", tx, wallet, this$1.txIndex[wallet], this$1.txIndex[wallet].txs)
          return
        } else {
          this$1.txIndex[wallet].txs[tx].data = transaction
          this$1.txIndex[wallet].txs[tx].executed = 1
        }

        if (this.txUpdateFinished) {
          console.log("ADDING TXFROMRAW ", transaction)
          this$1.wallet.db.addTXFromRaw(transaction)
        }
        this$1.checkGapLimit(wallet)
        this$1.updateTick()

      }
    }

    var this$1 = this
    this.electrum.getAddresHistory(wallet).then(function(transactions) {
      this$1.txIndex[wallet].executed = 1
      for (var j in transactions) {
        if (typeof this$1.txIndex[wallet].txs[transactions[j].tx_hash] == "object")
          return
        this$1.txIndex[wallet].txs[transactions[j].tx_hash] = {
          height: transactions[j].height,
          data: "",
          executed: 0
        }
        var tx = transactions[j].tx_hash
        this$1.electrum.getTransaction(transactions[j].tx_hash).then(getCallback(tx, wallet))
      }
      this$1.updateTick()
    })
  }

  subscribeToUpdates() {
    this.hashUpdateInProgress = 1
    var this$1 = this

    function compileHistoryCallback(j, tx, transactions) {
      return function(rawTX) {
        this$1.txIndex[i].txs[tx] = {
          height: transactions[j].height,
          data: rawTX,
          executed: 1
        }
        this$1.wallet.db.addTXFromRaw(rawTX)
      }
    }

    function compileCallback(i) {
      return function(hash) {
        if (this$1.txIndex[i].transactionHash == -1) {
          this$1.txIndex[i].transactionHash = hash
          console.log("Subscribed to ", i)
          return
        }
        if (this$1.txIndex[i].transactionHash == hash)
          return
        console.log("got new transactions for ", i, this$1.txIndex[i].transactionHash, hash)

        this$1.electrum.getAddresHistory(i).then(function(transactions) {
          for (var j in transactions) {
            var tx = transactions[j].tx_hash
            this$1.electrum.getTransaction(tx).then(compileHistoryCallback(j, tx, transactions))
          }
          this$1.updateTick()
        })
      }
    }

    for (var i in this.txIndex) {
      console.log("Subscribing to ", i)
      this.electrum.subscribeToAddress(i).then(compileCallback(i))
    }
  }

  processElectrumData() {

    function hexToBytes(hex) {
      for (var bytes = new Buffer(hex.length / 2), c = 0; c < hex.length; c += 2)
        bytes[c / 2] = parseInt(hex.substr(c, 2), 16)
      return bytes
    }

    // console.log("Start Electrum Update Process");

    var txMappedTxList = []

    function sortMappedList(list) {
      var _fl = 0
      var a = {}

      for (var _i = 0; _i <= list.length - 2; _i++) {
        for (var _j = _i + 1; _j <= list.length - 1; _j++) {
          _fl = 0
          for (var _o = 0; _o <= list[_i].prevOuts.length - 1; _o++) {
            if (list[_i].prevOuts[_o] == list[_j].hash) {
              _fl = 1
            }
          }
          if (_fl) {
            a = list[_i]
            list[_i] = list[_j]
            list[_j] = a
            _j = _i + 1
          }
        }
      }
    }

    for (var i in this.txIndex) {
      for (var l in this.txIndex[i].txs) {
        var data = this.txIndex[i].txs[l].data
        var hash = l

        var prevOuts = []
        var txd = hexToBytes(data)
        var tx = bcoin.tx.fromRaw(txd)
        var txjson = tx.toJSON()

        for (var k = 0; k <= txjson.inputs.length - 1; k++) {
          prevOuts.push(txjson.inputs[k].prevout.hash)
        }

        txMappedTxList.push({
          prevOuts: prevOuts,
          data: data,
          hash: hash
        })
      }
    }

    sortMappedList(txMappedTxList)

    var this$1 = this

    this.txBalanceUpdateTotal = txMappedTxList.length

    var promiseList = []

    for (var j in txMappedTxList) {

      promiseList.push(this.wallet.db.addTXFromRaw(txMappedTxList[j].data))

    }

    Promise.all(promiseList).then(function() {
      this$1.wallet.getBalance(0).then(function(result) {
        // console.log("Balance======>",result);
        console.log("Final Balance: ", bcoin.amount.btc(result.unconfirmed + result.confirmed))
        this$1.masterBalance = result.confirmed + result.unconfirmed
        this$1.abcTxLibCallbacks.onBalanceChanged("BTC", this$1.masterBalance)

        this$1.subscribeToUpdates()
        this.txUpdateFinished = true

      })

      this$1.abcTxLibCallbacks.onAddressesChecked(1)
    })

  }

  startEngine() {
    var this$1 = this

    return this$1.walletdb.open().then(function() {

        console.log("KEYINFO", this$1.keyInfo)

        if (typeof this$1.keyInfo.keys.bitcoinKey == "undefined") {
          console.log("KEY FORMAT VIOLATION!!!! keyInfo.keys.bitcoinKey required", this$1.keyInfo)
          return false
        }

        var w = new bcoin.hd.PrivateKey()

        var b = new Buffer(this$1.keyInfo.keys.bitcoinKey, "base64")
        var hex = b.toString("hex")

        w.fromSeed(hex)

        var key = w.toJSON()

        console.log("XPRIV", key.xprivkey)

        return this$1.walletdb.create({
          "master": key.xprivkey,
          "id": "AirBitzMain"
        })
      })
      .then(function(wallet) {

        this$1.wallet = wallet

        this$1.wallet.getAccountPaths(0).then(function(result) {

          var a
          for (var i in result) {
            a = result[i].toAddress()

            console.log(i, "Paths======>", a.toString())
            this$1.addresses.push(a.toString())
          }

          this$1.txUpdateTotalEntries = this$1.addresses.length

          for (var j in this$1.addresses) {
            this$1.processAddress(this$1.addresses[j])
          }

          // this$1.tcpClientConnect()

        })

        this$1.wallet.on('balance', function(balance) {
          // console.log('Balance updated.',this$1.txBalanceUpdateTotal, this$1.txBalanceUpdateProgress);
          if (this$1.txUpdateFinished) {

            console.log("STABLE TOP : ", bcoin.amount.btc(balance.unconfirmed))
            this$1.masterBalance = balance.confirmed + balance.unconfirmed
            this$1.abcTxLibCallbacks.onBalanceChanged("BTC", this$1.masterBalance)

          } else {
            console.log("UNSTABLE TOP : ", bcoin.amount.btc(balance.unconfirmed))
          }
          // console.log("Balance======>",result);
        })

      })

  }

  killEngine() {
    // disconnect network connections
    // clear caches

    this.engineOn = false

    return true
  }

  // synchronous
  getBlockHeight() {
    return this.walletLocalData.blockHeight
  }

  // asynchronous
  enableTokens(tokens) {
    var this$1 = this
    if (tokens === void 0) tokens = []

    for (var n in tokens) {
      var token = tokens[n]
      if (this$1.walletLocalData.enabledTokens.indexOf(token) !== -1) {
        this$1.walletLocalData.enabledTokens.push(token)
      }
    }
    // return Promise.resolve(dataStore.enableTokens(tokens))
  }

  // synchronous
  getBalance(options) {


    var this$1 = this

    // setTimeout(function() {
    //   this$1.collectGarbage()
    // }, 200)

    this.wallet.getBalance(0).then(function(result) {
      // console.log("Balance======>",result.confirmed);
      this$1.masterBalance = result.confirmed + result.unconfirmed
    })

    return this.masterBalance
  }

  // synchronous
  getNumTransactions(options) {
    if (options === void 0) options = {}

    var currencyCode = PRIMARY_CURRENCY
    if (options != null && options.currencyCode != null) {
      currencyCode = options.currencyCode
    }
    return this.walletLocalData.transactionsObj[currencyCode].length
  }

  // asynchronous
  getTransactions(options) {
    var this$1 = this
    if (options === void 0) options = {}

    var currencyCode = PRIMARY_CURRENCY
    if (options != null && options.currencyCode != null) {
      currencyCode = options.currencyCode
    }
    var prom = new Promise(function(resolve, reject) {
      var startIndex = 0
      var numEntries = 0
      if (options == null) {
        resolve(this$1.walletLocalData.transactionsObj[currencyCode].slice(0))
        return
      }
      if (options.startIndex != null && options.startIndex > 0) {
        startIndex = options.startIndex
        if (
          startIndex >=
          this$1.walletLocalData.transactionsObj[currencyCode].length
        ) {
          startIndex =
            this$1.walletLocalData.transactionsObj[currencyCode].length - 1
        }
      }
      if (options.numEntries != null && options.numEntries > 0) {
        numEntries = options.numEntries
        if (
          numEntries + startIndex >
          this$1.walletLocalData.transactionsObj[currencyCode].length
        ) {
          // Don't read past the end of the transactionsObj
          numEntries =
            this$1.walletLocalData.transactionsObj[currencyCode].length -
            startIndex
        }
      }

      // Copy the appropriate entries from the arrayTransactions
      var returnArray = []

      if (numEntries) {
        returnArray = this$1.walletLocalData.transactionsObj[currencyCode].slice(
          startIndex,
          numEntries + startIndex
        )
      } else {
        returnArray = this$1.walletLocalData.transactionsObj[currencyCode].slice(
          startIndex
        )
      }
      resolve(returnArray)
    })

    return prom
  }

  // synchronous
  getFreshAddress(options) {
    if (options === void 0) options = {}

    // Algorithm to derive master pub key from master private key
    //master public key = "pub[masterPrivateKey]". ie. "pub294709fe7a0sb0c8f7398f"
    // Algorithm to drive an address from index is "[index]-[masterPublicKey]" ie. "102-pub294709fe7a0sb0c8f7398f"
    // return this$1.wallet.createKey(0).then(function(res){
    //   return res.getAddress('base58check');
    // });
    // return this.masterWallet;
    if (this.addresses.length > this.wallet.account.receiveDepth) {
      var this$1 = this
      this.wallet.createKey(0).then(function(res) {
        // console.log(this$1.wallet.getAccount()); 
        // console.log("watching " + res.getAddress('base58check'));
        this$1.addresses.push(res.getAddress('base58check'))
      })
      return this.addresses[this.wallet.account.receiveDepth]
    }
    // return this.addressFromIndex(this.walletLocalData.unusedAddressIndex)
  }

  // synchronous
  addGapLimitAddresses(addresses, options) {
    var this$1 = this

    for (var i in addresses) {
      if (this$1.walletLocalData.gapLimitAddresses.indexOf(addresses[i]) === -1) {
        this$1.walletLocalData.gapLimitAddresses.push(addresses[i])
      }
    }
  }

  // synchronous
  isAddressUsed(address, options) {
    if (options === void 0) options = {}

    var idx = this.findAddress(address)
    if (idx !== -1) {
      var addrObj = this.walletLocalData.addressArray[idx]
      if (addrObj != null) {
        if (addrObj.txids.length > 0) {
          return true
        }
      }
    }
    idx = this.walletLocalData.gapLimitAddresses.indexOf(address)
    if (idx !== -1) {
      return true
    }
    return false
  }

  // synchronous
  makeSpend(abcSpendInfo) {

    var $this = this

    // console.log();
    // return;
    //1BynMxKHRyASZDNhX4q6pRtdzAb2m8d7jM

    //1DDeAGCAikvNemUHqCLJGsavAqQYfv5AbX

    // return;
    // returns an ABCTransaction data structure, and checks for valid info
    var prom = new Promise(function(resolve, reject) {


      var fee = parseInt($this.masterFee * 100000000) * 0.3

      var outputs = []

      outputs.push({
        currencyCode: "BTC",
        address: abcSpendInfo.spendTargets[0].publicAddress,
        amount: parseInt(abcSpendInfo.spendTargets[0].amountSatoshi)
      })


      const abcTransaction = new ABCTransaction('', // txid
        0, // date
        "BTC", // currencyCode
        '0', // blockHeightNative
        abcSpendInfo.spendTargets[0].amountSatoshi, // nativeAmount
        fee.toString(), // nativeNetworkFee
        '0', // signedTx
        {
          outputs: outputs
        } // otherParams
      )

      resolve(abcTransaction)
    })
    return prom
  }

  // asynchronous
  signTx(abcTransaction) {

    var this$1 = this
    var prom = new Promise(function(resolve, reject) {


      var fee = parseInt(this$1.masterFee * 100000000)

      var options = {
        outputs: [{
          address: abcTransaction.otherParams.outputs[0].address,
          value: parseInt(abcTransaction.otherParams.outputs[0].amount)
        }],
        rate: fee
      }

      console.log("signing", options)

      return this$1.wallet.send(options).then(function(tx) {

        console.log("after TX CREATED", tx)
          // Need to pass our passphrase back in to sign



        var rawTX = tx.toRaw().toString("hex")

        console.log('RAW tx:', rawTX)

        abcTransaction.date = Date.now() / 1000
        abcTransaction.signedTx = rawTX

        resolve(abcTransaction)


        // request.post({ url:'https://insight.bitpay.com/api/tx/send', form: {rawtx:rawTX} }, function(err,httpResponse,body){ 
        //   console.log("Transaction status", body)
        // })

        // return this$1.pool.broadcast(tx);

      })
    })

    return prom
  }

  // asynchronous
  broadcastTx(abcTransaction) {

    var this$1 = this

    var prom = new Promise(function(resolve, reject) {
      var requestString = '{ "id": "txsend", "method":"blockchain.transaction.broadcast", "params":["' + abcTransaction.signedTx + '"] }'

      this$1.tcpClientWrite(requestString + "\n")

      console.log("\n" + requestString + "\n")

      resolve(abcTransaction)

    })
    return prom
  }

  // asynchronous
  saveTx(abcTransaction) {

    var prom = new Promise(function(resolve, reject) {
      resolve(abcTransaction)
    })

    return prom
  }

}

export {
  ABCTxLibBTC
}