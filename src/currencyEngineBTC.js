// Replacing native crypto modules for ReactNative
import { Electrum } from './electrum'
import { ABCTransaction } from './abcTransaction'
import { txLibInfo } from './currencyInfoBTC'
import cs from 'coinstring'
import { bns } from 'biggystring'

// including Bcoin Engine
const bcoin = process.env.ENV === 'NODEJS' ? require('bcoin') : require('../vendor/bcoin.js')
const Buffer = process.env.ENV === 'NODEJS' ? require('buffer').Buffer : require('buffer/').Buffer

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
    this.electrumServers = opts.electrumServers || [
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
    this.txIndex = {}
    this.headerList = {}
    this.cachedLocalData = ''
    this.cachedLocalHeaderData = ''
    this.transactionHistory = {}
    this.watchAhead = 10
    this.txUpdateTotalEntries = 0
    this.txUpdateFinished = false
    this.txUpdateBalanceUpdateStarted = false
    this.txBalanceUpdateTotal = 0
    this.walletLocalData = {
      masterBalance: '0',
      blockHeight: 0,
      addresses: [],
      feesList: []
    }
  }

  onBlockHeightChanged (blockHeight) {
    if (this.walletLocalData.blockHeight < blockHeight) {
      this.walletLocalData.blockHeight = blockHeight
      this.abcTxLibCallbacks.onBlockHeightChanged(blockHeight)
      this.cacheLocalData()
    }
  }

  isTokenEnabled (token) {
    return this.walletLocalData.enabledTokens.indexOf(token) !== -1
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

  async startEngine () {
    const callbacks = {
      onAddressStatusChanged: this.processAddress.bind(this),
      onBlockHeightChanged: this.onBlockHeightChanged.bind(this)
    }
    this.electrum = new Electrum(this.electrumServers, callbacks, this.io)
    this.electrum.connect()
    let walletdb = new bcoin.wallet.WalletDB({ db: 'memory' })
    await walletdb.open()

    if (!this.keyInfo.keys) throw new Error('Missing Master Key')
    if (!this.keyInfo.keys.bitcoinKey) throw new Error('Missing Master Key')

    let bitcoinKeyBuffer = Buffer.from(this.keyInfo.keys.bitcoinKey, 'base64')

    let key = bcoin.hd.PrivateKey.fromSeed(bitcoinKeyBuffer)
    let wallet = await walletdb.create({
      'master': key.xprivkey(),
      'id': 'ID1'
    })

    this.wallet = wallet
    await this.getLocalData()

    this.wallet.on('balance', balance => {
      if (this.txUpdateFinished) {
        this.walletLocalData.masterBalance = bns.add(balance.confirmed.toString(), balance.unconfirmed.toString())
        this.abcTxLibCallbacks.onBalanceChanged('BTC', this.walletLocalData.masterBalance)
        this.cacheLocalData()
      }
    })
    let accountPath = await this.wallet.getAccountPaths(0)

    let checkList = accountPath.map(path => path.toAddress().toString())
    for (let l in checkList) {
      if (this.walletLocalData.addresses.indexOf(checkList[l]) === -1) {
        this.walletLocalData.addresses = checkList
        break
      }
    }
    this.txUpdateTotalEntries = this.walletLocalData.addresses.length
    this.walletLocalData.addresses.forEach(address => this.processAddress(address))
    this.electrum.subscribeToBlockHeight().then(blockHeight => this.onBlockHeightChanged(blockHeight))
  }

  async getLocalData () {
    try {
      let localWallet = await this.walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(DATA_STORE_FILE)
      .getText(DATA_STORE_FOLDER, 'walletLocalData')

      this.cachedLocalData = localWallet
      let data = JSON.parse(localWallet)
      this.walletLocalData.addresses = data.addresses || this.walletLocalData.addresses
      this.electrum.updateCache(data.txIndex)
      this.walletLocalData.masterBalance = data.balance || this.walletLocalData.masterBalance
      this.txIndex = data.txIndex || this.txIndex
      this.walletLocalData.blockHeight = data.blockHeight || this.walletLocalData.blockHeight
      this.walletLocalData.feesList = data.feesList || this.walletLocalData.feesList
      if (typeof data.headerList !== 'undefined') this.headerList = data.headerList
      this.abcTxLibCallbacks.onBalanceChanged('BTC', this.walletLocalData.masterBalance)
    } catch (e) {
      await this.cacheLocalData()
    }
    try {
      let localHeaders = await this.walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(HEADER_STORE_FILE)
      .getText(DATA_STORE_FOLDER, 'walletLocalData')

      let data = JSON.parse(localHeaders)
      if (!data.headerList) throw new Error('Something wrong with local headers ... X722', data)
      this.cachedLocalHeaderData = JSON.stringify(data.headerList)
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
      addresses: this.walletLocalData.addresses,
      balance: this.walletLocalData.masterBalance,
      blockHeight: this.walletLocalData.blockHeight,
      feesList: this.walletLocalData.feesList
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
    this.walletLocalData.addresses.push(address)
    this.processAddress(address)
  }

  deriveAddresses (amount) {
    for (var i = 1; i <= amount; i++) {
      // console.log("REQUESTING NEW ADDRESS")
      this.txUpdateTotalEntries++
      this.wallet.createKey(0).then(res => {
        var address = res.getAddress('base58check')
        if (this.walletLocalData.addresses.indexOf(address) > -1) {
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
    var total = this.walletLocalData.addresses.length
    var walletIndex = this.walletLocalData.addresses.indexOf(wallet) + 1
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

    this$1.electrum.subscribeToAddress(wallet).then(function (hash) {
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
    /// / console.log("Start Electrum Update Process");

    let txMappedTxList = []

    let sortMappedList = list => {
      let _fl = 0
      let a = {}

      for (let _i = 0; _i <= list.length - 2; _i++) {
        for (let _j = _i + 1; _j <= list.length - 1; _j++) {
          _fl = 0
          for (let _o = 0; _o <= list[_i].prevOuts.length - 1; _o++) {
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

    for (let i in this.txIndex) {
      for (let l in this.txIndex[i].txs) {
        let data = this.txIndex[i].txs[l].data
        let hash = l
        let prevOuts = []
        let txd = Buffer.from(data, 'hex')
        let tx = bcoin.tx.fromRaw(txd)
        let txjson = tx.toJSON()

        for (let k = 0; k <= txjson.inputs.length - 1; k++) {
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

    this.txBalanceUpdateTotal = txMappedTxList.length

    var promiseList = []

    for (var j in txMappedTxList) {
      promiseList.push(this.wallet.db.addTXFromRaw(txMappedTxList[j].data))
    }

    Promise.all(promiseList).then(() => {
      this.wallet.getBalance(0).then(result => {
        /// / console.log("Balance======>",result);
        // console.log("Final Balance: ", bcoin.amount.btc(result.unconfirmed + result.confirmed))

        this.walletLocalData.masterBalance = bns.add(result.confirmed.toString(), result.unconfirmed.toString())
        this.abcTxLibCallbacks.onBalanceChanged('BTC', this.walletLocalData.masterBalance)
        this.refreshTransactionHistory()

        this.txUpdateFinished = true
        this.cacheLocalData()
      })

      this.abcTxLibCallbacks.onAddressesChecked(1)
    })
  }

  getNewHeadersList () {
    let result = []
    for (let i in this.txIndex) {
      for (let j in this.txIndex[i].txs) {
        let h = this.txIndex[i].txs[j].height
        if (h < 0) continue
        if (!this.headerList[h] && result.indexOf(h) === -1) {
          result.push(h)
        }
      }
    }
    // console.log('OLD/NEW LIST HEADERS', this.headerList, result)
    return result
  }

  pullBlockHeaders () {
    let newHeadersList = this.getNewHeadersList()
    var this$1 = this
    let prom = []

    function getCallback (i) {
      return function (block) {
        // console.log('Setting block', i, block.timestamp)
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

  async refreshTransactionHistory () {
    await this.pullBlockHeaders()
    let res = await this.wallet.getHistory()
    let transactionList = []
    for (let i in res) {
      let tx = res[i].tx
      let inputs = tx.inputs
      let address
      let hash = tx.txid()
      if (this.transactionHistory[hash]) {
        continue
      }
      /// / console.log("inputs ==> ", inputs)
      let outgoingTransaction = false
      let totalAmount = 0
      let ts = Math.floor(Date.now() / 1000)
      for (let j in inputs) {
        address = inputs[j].getAddress().toBase58()
        let addressIndex = this.walletLocalData.addresses.indexOf(address)
        if (addressIndex > -1) {
          if (typeof this.headerList[this.txIndex[this.walletLocalData.addresses[addressIndex]].txs[hash].height] !== 'undefined') {
            ts = this.headerList[this.txIndex[this.walletLocalData.addresses[addressIndex]].txs[hash].height].timestamp
            console.log('Getting timestamp from list, input', ts)
          }
          outgoingTransaction = true
        }
        /// / console.log("I>>",address )
      }
      let outputs = tx.outputs
        /// / console.log("OUTPUTS ==> ", outputs)
      for (let j in outputs) {
        address = outputs[j].getAddress().toBase58()
        let addressIndex = this.walletLocalData.addresses.indexOf(address)
        if (addressIndex > -1 && typeof this.headerList[this.txIndex[this.walletLocalData.addresses[addressIndex]].txs[hash].height] !== 'undefined') {
          ts = this.headerList[this.txIndex[this.walletLocalData.addresses[addressIndex]].txs[hash].height].timestamp
          console.log('Getting timestamp from list, output', ts)
        }
        if ((addressIndex === -1 && outgoingTransaction) || (!outgoingTransaction && addressIndex > -1)) {
          totalAmount += outputs[j].value
        }
        /// / console.log("O>",address, "V>",outputs[j].value )
      }
      let d = ts
      totalAmount = (outgoingTransaction) ? -totalAmount : totalAmount
      let t = new ABCTransaction(hash, d, 'BTC', 1, totalAmount, 10000, 'signedTx', {})
      this.transactionHistory[hash] = t
      transactionList.push(t)
    }
    if (this.abcTxLibCallbacks.onTransactionsChanged) {
      this.abcTxLibCallbacks.onTransactionsChanged(transactionList)
    }
  }

  async killEngine () {
    this.electrum = null
    await this.cacheHeadersLocalData()
    await this.cacheLocalData()
    return true
  }

  // synchronous
  getBlockHeight () {
    return this.walletLocalData.blockHeight
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
    return this.walletLocalData.masterBalance
  }

  // synchronous
  getNumTransactions ({currencyCode = PRIMARY_CURRENCY} = {currencyCode: PRIMARY_CURRENCY}) {
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

  getFreshAddress (options = {}) {
    for (let i = 0; i < this.walletLocalData.addresses.length; i++) {
      let address = this.walletLocalData.addresses[i]
      if (!Object.keys(this.txIndex[address].txs).length) return address
    }
    return false
  }

  // synchronous
  isAddressUsed (address, options = {}) {
    let validator = cs.createValidator(0x00)
    if (!validator(address)) throw new Error('Wrong formatted address')
    if (this.walletLocalData.addresses.indexOf(address) === -1) throw new Error('Address not found in wallet')
    if (!this.txIndex[address]) return true
    return Object.keys(this.txIndex[address].txs).length !== 0
  }

  // synchronous
  async makeSpend (abcSpendInfo) {
    /// / console.log();
    // return;
    // 1BynMxKHRyASZDNhX4q6pRtdzAb2m8d7jM

    // 1DDeAGCAikvNemUHqCLJGsavAqQYfv5AbX

    // return;
    // returns an ABCTransaction data structure, and checks for valid info
    let fee = parseInt(this.masterFee * 100000000) * 0.3

    let outputs = []

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

    return abcTransaction
  }

  // asynchronous
  async signTx (abcTransaction) {
    let fee = parseInt(this.masterFee * 100000000)
    let options = {
      outputs: [{
        address: abcTransaction.otherParams.outputs[0].address,
        value: parseInt(abcTransaction.otherParams.outputs[0].amount)
      }],
      rate: fee
    }
    let tx = await this.wallet.send(options)
    let rawTX = tx.toRaw().toString('hex')
    abcTransaction.date = Date.now() / 1000
    abcTransaction.signedTx = rawTX
    return abcTransaction
  }

  // asynchronous
  async broadcastTx (abcTransaction) {
    if (!abcTransaction.signedTx) throw new Error('Tx is not signed')
    let serverResponse = await this.electrum.broadcastTransaction(abcTransaction.signedTx)
    if (!serverResponse) throw new Error('Electrum server internal error processing request')
    if (serverResponse === 'TX decode failed') throw new Error('Tx is not valid')
    return serverResponse
  }

  // asynchronous
  saveTx (abcTransaction) {
    var prom = new Promise(function (resolve, reject) {
      resolve(abcTransaction)
    })

    return prom
  }
}
