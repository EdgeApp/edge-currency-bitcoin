// Replacing native crypto modules for ReactNative
import { Electrum } from './electrum'
import { ABCTransaction } from './abcTransaction'
import { txLibInfo } from './currencyInfoBTC'
import cs from 'coinstring'
import { bns } from 'biggystring'
import bcoin from 'bcoin'

const GAP_LIMIT = 25
const MAX_FEE = 1000000
const FEE_UPDATE_INTERVAL = 10000
const DATA_STORE_FOLDER = 'txEngineFolderBTC'
const DATA_STORE_FILE = 'walletLocalDataV4.json'
const HEADER_STORE_FILE = 'headersV1.json'

const PRIMARY_CURRENCY = txLibInfo.getInfo.currencyCode
const DEFUALT_ELECTRUM_SERVERS = txLibInfo.getInfo.defaultsSettings.electrumServers
const DEFUALT_FEE_SERVER = txLibInfo.getInfo.defaultsSettings.feeInfoServer
const SIMPLE_FEE_SETTINGS = txLibInfo.getInfo.defaultsSettings.simpleFeeSettings

export class BitcoinEngine {
  constructor (io, keyInfo, opts = {}) {
    this.io = io
    this.keyInfo = keyInfo
    this.wallet = null

    // Only lines to change on engine to add network type based wallet //
    this.network = keyInfo.type === 'wallet:testnet' ? 'testnet' : 'main'
    this.magicByte = this.network === 'testnet' ? 0x6F : 0x00
    // /////////////////////////////////////////////////////////////// //

    this.abcTxLibCallbacks = opts.callbacks
    this.walletLocalFolder = opts.walletLocalFolder
    this.electrumServers = DEFUALT_ELECTRUM_SERVERS
    this.feeInfoServer = DEFUALT_FEE_SERVER
    if (opts.optionalSettings && opts.optionalSettings.enableOverrideServers) {
      this.electrumServers = opts.optionalSettings.electrumServers || this.electrumServers
      this.feeInfoServer = opts.optionalSettings.feeInfoServer || this.feeInfoServer
    }
    this.headerList = {}
    this.cachedLocalData = ''
    this.cachedLocalHeaderData = ''
    this.transactionHistory = {}
    this.txUpdateTotalEntries = 0
    this.txUpdateBalanceUpdateStarted = false
    this.txBalanceUpdateTotal = 0
    this.feeUpdater = null
    this.walletLocalData = {
      masterBalance: '0',
      blockHeight: 0,
      addresses: [],
      detailedFeeTable: {},
      simpleFeeTable: {},
      txIndex: {}
    }
    this.electrumCallbacks = {
      onAddressStatusChanged: this.processAddress.bind(this),
      onBlockHeightChanged: this.onBlockHeightChanged.bind(this)
    }
  }

  async addTxToWallet (rawTx) {
    const tx = bcoin.primitives.TX.fromRaw(Buffer.from(rawTx, 'hex'))
    return this.wallet.db.addTX(tx)
  }

  updateFeeTable () {
    this.io.fetch(this.feeInfoServer)
    .then(res => res.json())
    .then(({ fees }) => {
      let high = fees[fees.length - 1].minFee
      for (let i = fees.length - 1; i >= 0; i--) {
        if (fees[i].maxDelay !== 0) break
        high = fees[i].minFee
      }
      let low = fees[0].minFee
      let highestMaxDelay = fees[0].maxDelay
      for (let i = 1; i < fees.length; i++) {
        low = fees[i].minFee
        if (fees[i].maxDelay < highestMaxDelay) break
      }
      let standard = (low + high) / 2
      this.walletLocalData.detailedFeeTable = { updated: Date.now(), low, standard, high }
    })
    .catch(err => console.log(err))

    if (this.electrum && this.electrum.connected) {
      for (let setting in SIMPLE_FEE_SETTINGS) {
        this.electrum.getEstimateFee(SIMPLE_FEE_SETTINGS[setting])
        .then(fee => fee !== -1 && (this.walletLocalData.simpleFeeTable[setting] = { updated: Date.now(), fee }))
        .catch(err => console.log(err))
      }
    }
  }

  onBlockHeightChanged (blockHeight) {
    if (this.walletLocalData.blockHeight < blockHeight) {
      this.walletLocalData.blockHeight = blockHeight
      this.abcTxLibCallbacks.onBlockHeightChanged(blockHeight)
      this.cacheLocalData()
    }
  }

  // //////////////////////////////////////////////////////// NEXT 6 FUNCTIONS NEEDS A MAJOR REWRITE ///////////////////////////////////////////////////////
  // Needs Rewrite
  async processAddress (address) {
    if (typeof this.walletLocalData.txIndex[address] !== 'object') {
      this.walletLocalData.txIndex[address] = {
        txs: {},
        executed: 0,
        transactionHash: -1
      }
    } else {
      this.walletLocalData.txIndex[address].executed = 0
    }
    let hash = await this.electrum.subscribeToAddress(address)
    if (hash === null) {
      this.walletLocalData.txIndex[address].transactionHash = hash
      this.walletLocalData.txIndex[address].executed = 1
      this.updateTick()
      return
    }
    if (this.walletLocalData.txIndex[address].transactionHash === hash) {
      this.walletLocalData.txIndex[address].executed = 1
      this.updateTick()
      return
    }

    this.walletLocalData.txIndex[address].transactionHash = hash
    let transactions = await this.electrum.getAddresHistory(address)

    this.walletLocalData.txIndex[address].executed = 1
    for (let j in transactions) {
      if (typeof this.walletLocalData.txIndex[address].txs[transactions[j].tx_hash] === 'object') {
        this.walletLocalData.txIndex[address].txs[transactions[j].tx_hash].height = transactions[j].height
        continue
      }
      this.walletLocalData.txIndex[address].txs[transactions[j].tx_hash] = {
        height: transactions[j].height,
        data: '',
        executed: 0
      }
      let txHash = transactions[j].tx_hash
      let transaction = await this.electrum.getTransaction(txHash)

      if (this.walletLocalData.txIndex[address].txs[txHash]) {
        this.walletLocalData.txIndex[address].txs[txHash].data = transaction
        this.walletLocalData.txIndex[address].txs[txHash].executed = 1
      }

      this.addTxToWallet(transaction)
      this.checkGapLimit(address)
      this.updateTick()
    }
  }

  // Needs Rewrite
  updateTick () {
    var totalAddresses = this.txUpdateTotalEntries
    var executedAddresses = 0
    var totalTransactions = 0
    var executedTransactions = 0

    for (var i in this.walletLocalData.txIndex) {
      if (!this.walletLocalData.txIndex[i].executed) continue
      executedAddresses++
      for (var j in this.walletLocalData.txIndex[i].txs) {
        if (!this.walletLocalData.txIndex[i].txs[j]) continue
        totalTransactions++
        if (this.walletLocalData.txIndex[i].txs[j].executed) {
          executedTransactions++
        }
      }
    }

    var addressProgress = executedAddresses / totalAddresses
    var transactionProgress = (totalTransactions > 0) ? executedTransactions / totalTransactions : 0

    if (addressProgress === 1 && totalTransactions === 0) {
      transactionProgress = 1
    }

    var totalProgress = addressProgress * transactionProgress
    if (totalProgress === 1 && !this.txUpdateBalanceUpdateStarted) {
      this.txUpdateBalanceUpdateStarted = 1
      this.processElectrumData()
    }
    return totalProgress
  }

  // Needs rewrite
  processElectrumData () {
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
    for (let i in this.walletLocalData.txIndex) {
      for (let l in this.walletLocalData.txIndex[i].txs) {
        let data = this.walletLocalData.txIndex[i].txs[l].data
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
    let promiseList = txMappedTxList.map(({data}) => this.addTxToWallet(data))
    Promise.all(promiseList)
    .then(() => {
      this.abcTxLibCallbacks.onAddressesChecked(1)
      return this.wallet.getBalance(0)
    })
    .then(result => {
      this.walletLocalData.masterBalance = bns.add(result.confirmed.toString(), result.unconfirmed.toString())
      this.abcTxLibCallbacks.onBalanceChanged(PRIMARY_CURRENCY, this.walletLocalData.masterBalance)
      this.refreshTransactionHistory()
      this.cacheLocalData()
    })
  }

  // Needs rewrite
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
      let outgoingTransaction = false
      let totalAmount = 0
      let ts = Math.floor(Date.now() / 1000)
      for (let j in inputs) {
        address = inputs[j].getAddress().toBase58()
        let addressIndex = this.walletLocalData.addresses.indexOf(address)
        if (addressIndex > -1) {
          if (typeof this.headerList[this.walletLocalData.txIndex[this.walletLocalData.addresses[addressIndex]].txs[hash].height] !== 'undefined') {
            ts = this.headerList[this.walletLocalData.txIndex[this.walletLocalData.addresses[addressIndex]].txs[hash].height].timestamp
            console.log('Getting timestamp from list, input', ts)
          }
          outgoingTransaction = true
        }
      }
      let outputs = tx.outputs
      for (let j in outputs) {
        address = outputs[j].getAddress().toBase58()
        let addressIndex = this.walletLocalData.addresses.indexOf(address)
        if (addressIndex > -1 && typeof this.headerList[this.walletLocalData.txIndex[this.walletLocalData.addresses[addressIndex]].txs[hash].height] !== 'undefined') {
          ts = this.headerList[this.walletLocalData.txIndex[this.walletLocalData.addresses[addressIndex]].txs[hash].height].timestamp
          console.log('Getting timestamp from list, output', ts)
        }
        if ((addressIndex === -1 && outgoingTransaction) || (!outgoingTransaction && addressIndex > -1)) {
          totalAmount += outputs[j].value
        }
      }
      let d = ts
      totalAmount = (outgoingTransaction) ? -totalAmount : totalAmount
      let t = new ABCTransaction(hash, d, PRIMARY_CURRENCY, 1, totalAmount, 10000, 'signedTx', {})
      this.transactionHistory[hash] = t
      transactionList.push(t)
    }
    if (this.abcTxLibCallbacks.onTransactionsChanged) {
      this.abcTxLibCallbacks.onTransactionsChanged(transactionList)
    }
  }

  // Needs rewrite
  async pullBlockHeaders () {
    let newHeadersList = this.getNewHeadersList()
    let prom = []
    let getCallback = (i) => {
      return block => { this.headerList[i] = block }
    }
    for (let i in newHeadersList) {
      prom.push(this.electrum.getBlockHeader(newHeadersList[i]).then(getCallback(newHeadersList[i])))
    }
    await Promise.all(prom)
    if (newHeadersList.length > 1) {
      this.cacheHeadersLocalData()
    }
  }

  // Needs rewrite
  getNewHeadersList () {
    let result = []
    for (let i in this.walletLocalData.txIndex) {
      for (let j in this.walletLocalData.txIndex[i].txs) {
        let h = this.walletLocalData.txIndex[i].txs[j].height
        if (h < 0) continue
        if (!this.headerList[h] && result.indexOf(h) === -1) {
          result.push(h)
        }
      }
    }
    return result
  }

  // Needs rewrite
  checkGapLimit (address) {
    var total = this.walletLocalData.addresses.length
    var addressIndex = this.walletLocalData.addresses.indexOf(address) + 1
    if (addressIndex + GAP_LIMIT > total) {
      this.deriveAddresses(addressIndex + GAP_LIMIT - total)
    }
  }

  // Needs rewrite
  deriveAddresses (amount) {
    for (var i = 1; i <= amount; i++) {
      this.txUpdateTotalEntries++
      this.wallet.createKey(0).then(res => {
        var address = res.getAddress('base58check').toString()
        if (this.walletLocalData.addresses.indexOf(address) > -1) {
          this.txUpdateTotalEntries--
          return
        }
        this.walletLocalData.addresses.push(address)
        this.processAddress(address)
      })
    }
  }
  // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async startEngine () {
    this.electrum = new Electrum(this.electrumServers, this.electrumCallbacks, this.io)
    this.electrum.connect()

    // Needs to replace next 2 lines since it's a super hack //
    let opts = { db: 'memory' }
    if (this.network !== 'main') Object.assign(opts, { network: this.network }) // Hack for now as long as we are using nbcoin version
    // ////////////////////////

    let walletdb = new bcoin.wallet.WalletDB(opts)
    await walletdb.open()
    if (!this.keyInfo.keys) throw new Error('Missing Master Key')
    if (!this.keyInfo.keys.bitcoinKey) throw new Error('Missing Master Key')

    let bitcoinKeyBuffer = Buffer.from(this.keyInfo.keys.bitcoinKey, 'base64')

    let key = bcoin.hd.PrivateKey.fromSeed(bitcoinKeyBuffer, this.network)
    let wallet = await walletdb.create({
      'master': key.xprivkey(),
      'id': 'ID1'
    })

    this.wallet = wallet
    await this.getLocalData()

    this.wallet.on('balance', balance => {
      this.walletLocalData.masterBalance = bns.add(balance.confirmed.toString(), balance.unconfirmed.toString())
      this.abcTxLibCallbacks.onBalanceChanged(PRIMARY_CURRENCY, this.walletLocalData.masterBalance)
      this.cacheLocalData()
    })
    let accountPath = await this.wallet.getAccountPaths(0)
    let checkList = accountPath.map(path => path.toAddress(this.network).toString())
    for (let l in checkList) {
      if (this.walletLocalData.addresses.indexOf(checkList[l]) === -1) {
        this.walletLocalData.addresses = checkList
        break
      }
    }

    this.txUpdateTotalEntries = this.walletLocalData.addresses.length
    this.walletLocalData.addresses.forEach(address => this.processAddress(address))
    this.electrum.subscribeToBlockHeight().then(blockHeight => this.onBlockHeightChanged(blockHeight))
    if (!Object.keys(this.walletLocalData.detailedFeeTable).length) await this.updateFeeTable()
    else this.updateFeeTable()
    this.feeUpdater = setInterval(() => this.updateFeeTable(), FEE_UPDATE_INTERVAL)
  }

  async getLocalData () {
    try {
      let localWallet = await this.walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(DATA_STORE_FILE)
      .getText(DATA_STORE_FOLDER, 'walletLocalData')
      this.cachedLocalData = localWallet
      let data = JSON.parse(localWallet)
      Object.assign(this.walletLocalData, data)
      console.log(this.walletLocalData)
      this.electrum.updateCache(data.txIndex)
      if (typeof data.headerList !== 'undefined') this.headerList = data.headerList
      this.abcTxLibCallbacks.onBalanceChanged(PRIMARY_CURRENCY, this.walletLocalData.masterBalance)
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
    const walletJson = JSON.stringify(this.walletLocalData)
    if (this.cachedLocalData === walletJson) return true
    await this.walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(DATA_STORE_FILE)
      .setText(walletJson)
    this.cachedLocalData = walletJson
    return true
  }

  updateSettings (opts) {
    if (opts.electrumServers) {
      this.electrumServers = opts.electrumServers
      this.electrum = new Electrum(this.electrumServers, this.electrumCallbacks, this.io)
      this.electrum.connect()
    }
  }

  async killEngine () {
    this.electrum = null
    clearInterval(this.feeUpdater)
    await this.cacheHeadersLocalData()
    await this.cacheLocalData()
    return true
  }

  getBlockHeight () {
    return this.walletLocalData.blockHeight
  }

  getBalance (options) {
    return this.walletLocalData.masterBalance
  }

  getNumTransactions ({currencyCode = PRIMARY_CURRENCY} = {currencyCode: PRIMARY_CURRENCY}) {
    return this.walletLocalData.txIndex.reduce((s, addressTxs) => s + addressTxs.length, 0)
  }

  async getTransactions (options) {
    let transactions = this.walletLocalData.txIndex.reduce((s, addressTxs) => s.concat(addressTxs), [])
    let abcTransactions = transactions.map(({ abcTransaction }) => abcTransaction)
    let startIndex = options.startIndex || 0
    let endIndex = options.numEntries || abcTransactions.length
    if (startIndex + endIndex > abcTransactions.length) endIndex = abcTransactions.length
    return abcTransactions.slice(startIndex, endIndex)
  }

  getFreshAddress (options = {}) {
    for (let i = 0; i < this.walletLocalData.addresses.length; i++) {
      let address = this.walletLocalData.addresses[i]
      if (!Object.keys(this.walletLocalData.txIndex[address].txs).length) return address
    }
    return false
  }

  isAddressUsed (address, options = {}) {
    let validator = cs.createValidator(this.magicByte)
    if (!validator(address)) throw new Error('Wrong formatted address')
    if (this.walletLocalData.addresses.indexOf(address) === -1) throw new Error('Address not found in wallet')
    if (!this.walletLocalData.txIndex[address]) return false
    return Object.keys(this.walletLocalData.txIndex[address].txs).length !== 0
  }

  async makeSpend (abcSpendInfo) {
    if (!abcSpendInfo.spendTargets) throw new Error('Need to provide Spend Targets')

    let feeOption = abcSpendInfo.networkFeeOption || 'standard'
    let rate, resultedTransaction

    if (feeOption === 'custom') {
      rate = parseInt(abcSpendInfo.customNetworkFee)
    } else {
      rate = this.walletLocalData.detailedFeeTable[feeOption]
    }

    let outputs = abcSpendInfo.spendTargets.map(spendTarget => {
      return new bcoin.primitives.Output({
        value: parseInt(spendTarget.nativeAmount),
        script: bcoin.script.fromAddress(spendTarget.publicAddress)
      })
    })

    let txOptions = { outputs, rate: rate * 1000, maxFee: MAX_FEE }
    try {
      resultedTransaction = await this.wallet.createTX(txOptions)
    } catch (e) {
      if (e.type === 'FundingError') throw new Error('InsufficientFundsError')
      throw e
    }

    let sumOfTx = abcSpendInfo.spendTargets.reduce((s, spendTarget) => s + parseInt(spendTarget.nativeAmount), 0)
    let jsonTX = resultedTransaction.getJSON(this.network)
    let ourReceiveAddresses = jsonTX.outputs
    .map(({ address }) => address)
    .filter(address => address && this.walletLocalData.addresses.indexOf(address) !== -1)

    const abcTransaction = new ABCTransaction({
      ourReceiveAddresses,
      otherParams: {
        rawTx: resultedTransaction
      },
      currencyCode: PRIMARY_CURRENCY,
      txid: null,
      date: null,
      blockHeight: -1,
      nativeAmount: '-' + (sumOfTx + parseInt(resultedTransaction.getFee())).toString(),
      networkFee: resultedTransaction.getFee().toString(),
      runningBalance: this.getBalance(),
      signedTx: null
    })
    return abcTransaction
  }

  async signTx (abcTransaction) {
    await this.wallet.sign(abcTransaction.otherParams.rawTx)
    abcTransaction.date = Date.now() / 1000
    abcTransaction.signedTx = abcTransaction.otherParams.rawTx.toRaw()
    return abcTransaction
  }

  async broadcastTx (abcTransaction) {
    if (!abcTransaction.signedTx) throw new Error('Tx is not signed')
    let serverResponse = await this.electrum.broadcastTransaction(abcTransaction.signedTx.toString('hex'))
    if (!serverResponse) throw new Error('Electrum server internal error processing request')
    if (serverResponse === 'TX decode failed') throw new Error('Tx is not valid')
    return serverResponse
  }

  async saveTx (abcTransaction) {
    const tx = bcoin.primitives.TX.fromRaw(abcTransaction.signedTx)
    await this.wallet.db.addTX(tx)
  }

  addGapLimitAddresses (addresses) {
    addresses.forEach(address => this.checkGapLimit(address))
  }
}
