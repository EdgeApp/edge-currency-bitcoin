// Replacing native crypto modules for ReactNative
import { Electrum } from './electrum'
import { ABCTransaction } from './abcTransaction'
import { txLibInfo } from './currencyInfoBTC'

// including Bcoin Engine
let bcoin = process.env.ENV === 'NODEJS' ? require('bcoin') : require('../vendor/bcoin.js')

const GAP_LIMIT = 25
const DATA_STORE_FOLDER = 'txEngineFolderBTC'
const DATA_STORE_FILE = 'walletLocalDataV4.json'
const HEADER_STORE_FILE = 'headersV1.json'

const PRIMARY_CURRENCY = txLibInfo.getInfo.currencyCode
// const TOKEN_CODES = [PRIMARY_CURRENCY].concat(txLibInfo.supportedTokens)

export class BitcoinEngine {
  constructor (io, keyInfo, opts = {}) {
    this.io = io
    this.keyInfo = keyInfo
    this.abcTxLibCallbacks = opts.callbacks
    this.walletLocalFolder = opts.walletLocalFolder
    this.txIndex = {}
    this.connections = []
    this.walletsScanQueue = []
    this.transactionsStash = []
    this.headerList = {}
    this.cachedLocalData = ''
    this.cachedLocalHeaderData = ''
    this.transactionHistory = {}
    this.transactionTS = {}
    this.increasingLimitLoop = 0
    this.watchAhead = 10
    this.addressLimitLoop = 0
    this.txUpdateTotalEntries = 0
    this.txUpdateStarted = false
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
      ['h.1209k.com', '50001'],
      ['electrum-bu-az-weuro.airbitz.co', '50001'],
      ['electrum-bc-az-eusa.airbitz.co', '50001'],
      ['electrum-bu-az-ausw.airbitz.co', '50001'],
      ['electrum.hsmiths.com', '8080'],
      ['e.anonyhost.org', '50001'],
      ['electrum.no-ip.org', '50001'],
      ['electrum-bu-az-wusa2.airbitz.co', '50001'],
      ['electrum-bu-az-wjapan.airbitz.co', '50001'],
      ['kerzane.ddns.net', '50001']
    ]
    this.globalRecievedData = ['', '', '', '', '', '', '', '', '', '']
    this.addresses = []
    this.masterFee = 0
    this.masterFeeReuqested = 0
    this.masterFeeRecieved = 0
    this.baseUrl = ''
    this.blockHeight = 0
  }

  incommingTransaction () {
    var this$1 = this
    return function (wallet, hash) {
      this$1.processAddress(wallet, hash)
    }
  }

  onBlockHeightChanged () {
    let that = this
    return function (blockHeight) {
      if (that.blockHeight < blockHeight) {
        that.blockHeight = blockHeight
        that.abcTxLibCallbacks.onBlockHeightChanged(blockHeight)
        that.cacheLocalData()
      }
    }
  }

  engineLoop () {
    this.engineOn = true
    // this.saveWalletDataStore()
    this.electrum.subscribeToBlockHeight().then(blockHeight => this.onBlockHeightChanged()(blockHeight))
  }

  isTokenEnabled (token) {
    return this.walletLocalData.enabledTokens.indexOf(token) !== -1
  }

  fetchGet (cmd, params) {
    return this.io.fetch(this.baseUrl + cmd + '/' + params, {
      method: 'GET'
    })
  }

  fetchPost (cmd, body) {
    return this.io.fetch(this.baseUrl + cmd, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  updateTick () {
    // console.log("TICK UPDATE", this.txUpdateTotalEntries)
    var totalAddresses = this.txUpdateTotalEntries
    var executedAddresses = 0

    var totalTransactions = 0
    var executedTransactions = 0

    for (var i in this.txIndex) {
      if (!this.txIndex[i].executed) continue
      executedAddresses++
      for (var j in this.txIndex[i].txs) {
        if (!this.txIndex[i].txs[j]) continue
        totalTransactions++
        if (this.txIndex[i].txs[j].executed) {
          executedTransactions++
        }
      }
    }

    var addressProgress = executedAddresses / totalAddresses
    var transactionProgress = (totalTransactions > 0) ? executedTransactions / totalTransactions : 0

    if (addressProgress === 1 && totalTransactions === 0) {
      transactionProgress = 1
    }

    // var progress = [addressProgress, transactionProgress]

    // console.log("Total TX List:", Object.keys(this.txIndex), "totalAddresses:", totalAddresses, "executedAddresses:", executedAddresses, totalTransactions, executedTransactions, transactionProgress)

    var totalProgress = addressProgress * transactionProgress

    if (totalProgress === 1 && !this.txUpdateBalanceUpdateStarted) {
      this.txUpdateBalanceUpdateStarted = 1
        // console.log("PROCESSING ELECTRUM")
      this.processElectrumData()
    }

    return totalProgress
  }

  async getLocalData () {
    try {
      let localWallet = await this.walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(DATA_STORE_FILE)
      .getText(DATA_STORE_FOLDER, 'walletLocalData')

      this.cachedLocalData = localWallet
      let data = JSON.parse(localWallet)
      this.addresses = data.addresses
      this.electrum.updateCache(data.txIndex)
      this.masterBalance = data.balance
      this.txIndex = data.txIndex
      this.blockHeight = data.blockHeight
      if (typeof data.headerList !== 'undefined') this.headerList = data.headerList
      this.masterBalance && this.abcTxLibCallbacks.onBalanceChanged('BTC', this.masterBalance)
    } catch (e) {
      await this.cacheLocalData()
    }
    try {
      let localHeaders = await this.walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(HEADER_STORE_FILE)
      .getText(DATA_STORE_FOLDER, 'walletLocalData')

      let data = JSON.parse(localHeaders)
      this.cachedLocalHeaderData = JSON.stringify(data.headerList)
      if (!data.headerList) throw new Error('Something wrong with local headers ... X722', data)
      this.headerList = data.headerList
    } catch (e) {
      await this.cacheHeadersLocalData()
    }
    return true
  }

  async cacheHeadersLocalData () {
    const headerList = JSON.stringify(this.headerList)
    if (this.cachedLocalHeaderData === headerList) return true
    await this.walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(HEADER_STORE_FILE)
      .setText(JSON.stringify({
        headerList: this.headerList
      }))
    this.cachedLocalHeaderData = headerList
    return true
  }

  async cacheLocalData () {
    const walletJson = JSON.stringify({
      txIndex: this.txIndex,
      addresses: this.addresses,
      balance: this.masterBalance,
      blockHeight: this.blockHeight
    })
    if (this.cachedLocalData === walletJson) return true
    await this.walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(DATA_STORE_FILE)
      .setText(walletJson)
    this.cachedLocalData = walletJson
    return true
  }

  pushAddress (address) {
    this.addresses.push(address)
    this.processAddress(address)
  }

  deriveAddresses (amount) {
    for (var i = 1; i <= amount; i++) {
      // console.log("REQUESTING NEW ADDRESS")
      this.txUpdateTotalEntries++
      this.wallet.createKey(0).then(res => {
        var address = res.getAddress('base58check')
        if (this.addresses.indexOf(address) > -1) {
          // console.log("EXISTING ADDRESS ")
          this.txUpdateTotalEntries--
          return
        }
        /// / console.log("PUSHING NEW ADDRESS")
        this.pushAddress(address)
      })
    }
  }

  checkGapLimit (wallet) {
    var total = this.addresses.length
    var walletIndex = this.addresses.indexOf(wallet) + 1
    if (walletIndex + GAP_LIMIT > total) {
      this.deriveAddresses(walletIndex + GAP_LIMIT - total)
    }
  }

  processAddress (wallet) {
    var this$1 = this

    if (typeof this.txIndex[wallet] !== 'object') {
      this.txIndex[wallet] = {
        txs: {},
        executed: 0,
        transactionHash: -1
      }
    } else {
      this.txIndex[wallet].executed = 0
    }

    function getCallback (tx, wallet) {
      return function (transaction) {
        if (typeof this$1.txIndex[wallet].txs[tx] === 'undefined') {
          /// / console.log("BADTX", tx, wallet, this$1.txIndex[wallet], this$1.txIndex[wallet].txs)
          return
        } else {
          this$1.txIndex[wallet].txs[tx].data = transaction
          this$1.txIndex[wallet].txs[tx].executed = 1
        }

        if (this$1.txUpdateFinished) {
          // console.log("ADDING TXFROMRAW ", transaction)
          this$1.wallet.db.addTXFromRaw(transaction)
        }
        this$1.checkGapLimit(wallet)
        this$1.updateTick()
      }
    }

    this.electrum.subscribeToAddress(wallet).then(function (hash) {
      if (hash == null) {
        // console.log("NULL INCOMING", wallet, hash)
        this$1.txIndex[wallet].transactionHash = hash
        this$1.txIndex[wallet].executed = 1
        this$1.updateTick()
        return
      }
      if (this$1.txIndex[wallet].transactionHash === hash) {
        // console.log("HSAH INCOMING", wallet)
        this$1.txIndex[wallet].executed = 1
        this$1.updateTick()
        return
      }

      // console.log("got transactions for ", wallet, this$1.txIndex[wallet].transactionHash, hash)

      this$1.txIndex[wallet].transactionHash = hash

      return this$1.electrum.getAddresHistory(wallet).then(function (transactions) {
        // console.log("GOT full address history ", wallet)
        this$1.txIndex[wallet].executed = 1
        for (var j in transactions) {
          if (typeof this$1.txIndex[wallet].txs[transactions[j].tx_hash] === 'object') {
            this$1.txIndex[wallet].txs[transactions[j].tx_hash].height = transactions[j].height
            continue
          }
          this$1.txIndex[wallet].txs[transactions[j].tx_hash] = {
            height: transactions[j].height,
            data: '',
            executed: 0
          }
          var tx = transactions[j].tx_hash
          this$1.electrum.getTransaction(transactions[j].tx_hash).then(getCallback(tx, wallet))
        }
        this$1.updateTick()
      })
    })
  }

  processElectrumData () {
    function hexToBytes (hex) {
      for (var bytes = Buffer.from(hex.length / 2), c = 0; c < hex.length; c += 2) bytes[c / 2] = parseInt(hex.substr(c, 2), 16)
      return bytes
    }

    /// / console.log("Start Electrum Update Process");

    var txMappedTxList = []

    function sortMappedList (list) {
      var _fl = 0
      var a = {}

      for (var _i = 0; _i <= list.length - 2; _i++) {
        for (var _j = _i + 1; _j <= list.length - 1; _j++) {
          _fl = 0
          for (var _o = 0; _o <= list[_i].prevOuts.length - 1; _o++) {
            if (list[_i].prevOuts[_o] === list[_j].hash) {
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

    Promise.all(promiseList).then(function () {
      this$1.wallet.getBalance(0).then(function (result) {
        /// / console.log("Balance======>",result);
        // console.log("Final Balance: ", bcoin.amount.btc(result.unconfirmed + result.confirmed))

        this$1.masterBalance = result.confirmed + result.unconfirmed
        this$1.abcTxLibCallbacks.onBalanceChanged('BTC', this$1.masterBalance)
        this$1.refreshTransactionHistory()

        this$1.txUpdateFinished = true
        this$1.cacheLocalData()
      })

      this$1.abcTxLibCallbacks.onAddressesChecked(1)
    })
  }

  getNewHeadersList () {
    let result = []
    for (let i in this.txIndex) {
      for (let j in this.txIndex[i].txs) {
        let h = this.txIndex[i].txs[j].height

        if (h < 0) continue

        if (typeof this.headerList[h] === 'undefined' && result.indexOf(h) === -1) {
          result.push(h)
        }
      }
    }
    console.log('OLD/NEW LIST HEADERS', this.headerList, result)
    return result
  }

  pullBlockHeaders () {
    let newHeadersList = this.getNewHeadersList()
    var this$1 = this
    let prom = []

    function getCallback (i) {
      return function (block) {
        console.log('Setting block', i, block.timestamp)
        this$1.headerList[i] = block
      }
    }

    for (var i in newHeadersList) {
      prom.push(this.electrum.getBlockHeader(newHeadersList[i]).then(getCallback(newHeadersList[i])))
    }

    return Promise.all(prom).then(function () {
      if (newHeadersList.length > 1) {
        this$1.cacheHeadersLocalData()
      }
      return new Promise(function (resolve, reject) {
        resolve()
      })
    })
  }

  refreshTransactionHistory () {
    var this$1 = this

    return this.pullBlockHeaders().then(function () {
      // console.log("HEADERS COMPILED", this$1.headerList)

      this$1.wallet.getHistory().then(function (res) {
        var transactionList = []
        for (var i in res) {
          var tx = res[i].tx
          var inputs = tx.inputs
          var address
          var hash = tx.txid()
          if (this$1.transactionHistory[hash]) {
            continue
          }
          /// / console.log("inputs ==> ", inputs)
          var outgoingTransaction = false
          var totalAmount = 0
          var ts = Math.floor(Date.now() / 1000)
          for (let j in inputs) {
            address = inputs[j].getAddress().toBase58()
            let addressIndex = this$1.addresses.indexOf(address)
            if (addressIndex > -1) {
              if (typeof this$1.headerList[this$1.txIndex[this$1.addresses[addressIndex]].txs[hash].height] !== 'undefined') {
                ts = this$1.headerList[this$1.txIndex[this$1.addresses[addressIndex]].txs[hash].height].timestamp
                console.log('Getting timestamp from list, input', ts)
              }
              outgoingTransaction = true
            }
            /// / console.log("I>>",address )
          }
          var outputs = tx.outputs
            /// / console.log("OUTPUTS ==> ", outputs)
          for (let j in outputs) {
            address = outputs[j].getAddress().toBase58()
            let addressIndex = this$1.addresses.indexOf(address)
            if (addressIndex > -1 && typeof this$1.headerList[this$1.txIndex[this$1.addresses[addressIndex]].txs[hash].height] !== 'undefined') {
              ts = this$1.headerList[this$1.txIndex[this$1.addresses[addressIndex]].txs[hash].height].timestamp
              console.log('Getting timestamp from list, output', ts)
            }
            if ((addressIndex === -1 && outgoingTransaction) || (!outgoingTransaction && addressIndex > -1)) {
              totalAmount += outputs[j].value
            }
            /// / console.log("O>",address, "V>",outputs[j].value )
          }

          var d = ts
          totalAmount = (outgoingTransaction) ? -totalAmount : totalAmount

          var t = new ABCTransaction(hash, d, 'BTC', 1, totalAmount, 10000, 'signedTx', {})

          this$1.transactionHistory[hash] = t

          transactionList.push(t)

          /// / console.log("Transaction type",(outgoingTransaction)?"Spending":"Incoming", "Amount:", totalAmount)
        }
        console.log('TOTAL TRANSACTIONS LIST', transactionList, this$1.headerList)
        if (this$1.abcTxLibCallbacks.onTransactionsChanged) {
          this$1.abcTxLibCallbacks.onTransactionsChanged(transactionList)
        }
        // return transactionList;
      })
    })
  }

  async startEngine () {
    const callbacks = {
      incommingTransaction: this.incommingTransaction(),
      onBlockHeightChanged: this.onBlockHeightChanged()
    }
    this.electrum = new Electrum(this.electrumServers, callbacks, this.io)
    this.electrum.connect()
    let walletdb = new bcoin.wallet.WalletDB({ db: 'memory' })
    await walletdb.open()
    if (!this.keyInfo.keys || !this.keyInfo.keys.bitcoinKey) throw new Error('Missing Master Key')
    let key = bcoin.hd.PrivateKey.fromSeed(Buffer.from(this.keyInfo.keys.bitcoinKey, 'base64'))
    let wallet = await walletdb.create({
      'master': key.xprivkey(),
      'id': 'ID1'
    })

    this.wallet = wallet
    await this.getLocalData()

    this.wallet.on('balance', balance => {
      if (this.txUpdateFinished) {
        this.masterBalance = balance.confirmed + balance.unconfirmed
        this.abcTxLibCallbacks.onBalanceChanged('BTC', this.masterBalance)
        this.cacheLocalData()
      }
    })
    let accountPath = await this.wallet.getAccountPaths(0)

    let checkList = accountPath.map(path => path.toAddress().toString())
    for (let l in checkList) {
      if (this.addresses.indexOf(checkList[l]) === -1) {
        this.addresses = checkList
        break
      }
    }
    this.txUpdateTotalEntries = this.addresses.length
    this.addresses.forEach(address => this.processAddress(address))
    this.engineLoop()
  }

  async killEngine () {
    // disconnect network connections
    this.engineOn = false
    this.electrum = null
    await this.cacheHeadersLocalData()
    await this.cacheLocalData()
    return true
  }

  // synchronous
  getBlockHeight () {
    return this.blockHeight
  }

  // asynchronous
  enableTokens (tokens) {
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
  getBalance (options) {
    return this.masterBalance
  }

  // synchronous
  getNumTransactions (options) {
    if (options === void 0) options = {}

    var currencyCode = PRIMARY_CURRENCY
    if (options != null && options.currencyCode != null) {
      currencyCode = options.currencyCode
    }
    return this.walletLocalData.transactionsObj[currencyCode].length
  }

  // asynchronous
  getTransactions (options) {
    var this$1 = this
    if (options === void 0) options = {}
    // console.log(this$1.walletLocalData)
    var currencyCode = PRIMARY_CURRENCY
    if (options != null && options.currencyCode != null) {
      currencyCode = options.currencyCode
    }
    var prom = new Promise(function (resolve, reject) {
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
  getFreshAddress (options) {
    if (options === void 0) options = {}

    // console.log("getting fresh address")

    // Looking for empty available address
    var txs
    var res = false

    for (var i in this.txIndex) {
      txs = Object.keys(this.txIndex[i].txs).length
      if (txs === 0) {
        res = this.addresses.indexOf(i)
        break
      }
    }

    if (this.addresses.length > res + GAP_LIMIT) {
      var this$1 = this
      this.wallet.createKey(0).then(function (res) {
        this$1.pushAddress(res.getAddress('base58check'))
      })
    }
    return this.addresses[res]
  }

  // synchronous
  isAddressUsed (address, options) {
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
  makeSpend (abcSpendInfo) {
    var $this = this

    /// / console.log();
    // return;
    // 1BynMxKHRyASZDNhX4q6pRtdzAb2m8d7jM

    // 1DDeAGCAikvNemUHqCLJGsavAqQYfv5AbX

    // return;
    // returns an ABCTransaction data structure, and checks for valid info
    var prom = new Promise(function (resolve, reject) {
      var fee = parseInt($this.masterFee * 100000000) * 0.3

      var outputs = []

      outputs.push({
        currencyCode: 'BTC',
        address: abcSpendInfo.spendTargets[0].publicAddress,
        amount: parseInt(abcSpendInfo.spendTargets[0].amountSatoshi)
      })

      const abcTransaction = new ABCTransaction('', // txid
        0, // date
        'BTC', // currencyCode
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
  signTx (abcTransaction) {
    var this$1 = this
    var prom = new Promise(function (resolve, reject) {
      var fee = parseInt(this$1.masterFee * 100000000)

      var options = {
        outputs: [{
          address: abcTransaction.otherParams.outputs[0].address,
          value: parseInt(abcTransaction.otherParams.outputs[0].amount)
        }],
        rate: fee
      }

      // console.log("signing", options)

      return this$1.wallet.send(options).then(function (tx) {
        // console.log("after TX CREATED", tx)
        // Need to pass our passphrase back in to sign

        var rawTX = tx.toRaw().toString('hex')

        // console.log('RAW tx:', rawTX)

        abcTransaction.date = Date.now() / 1000
        abcTransaction.signedTx = rawTX

        resolve(abcTransaction)

        // request.post({ url:'https://insight.bitpay.com/api/tx/send', form: {rawtx:rawTX} }, function(err,httpResponse,body){
        /// /   console.log("Transaction status", body)
        // })

        // return this$1.pool.broadcast(tx);
      })
    })

    return prom
  }

  // asynchronous
  broadcastTx (abcTransaction) {
    var this$1 = this

    var prom = new Promise(function (resolve, reject) {
      var requestString = '{ "id": "txsend", "method":"blockchain.transaction.broadcast", "params":["' + abcTransaction.signedTx + '"] }'

      this$1.tcpClientWrite(requestString + '\n')

      // console.log("\n" + requestString + "\n")

      resolve(abcTransaction)
    })
    return prom
  }

  // asynchronous
  saveTx (abcTransaction) {
    var prom = new Promise(function (resolve, reject) {
      resolve(abcTransaction)
    })

    return prom
  }
}
