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
      onAddressStatusChanged: this.handleTransactionStatusHash.bind(this),
      onBlockHeightChanged: this.onBlockHeightChanged.bind(this)
    }
  }

  static async makeEngine (io, keyInfo, opts = {}) {
    const engine = new BitcoinEngine(io, keyInfo, opts)
    await engine.loadCachedData()
    return engine
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
      const highestMaxDelay = fees[0].maxDelay
      for (let i = 1; i < fees.length; i++) {
        low = fees[i].minFee
        if (fees[i].maxDelay < highestMaxDelay) break
      }
      const standard = (low + high) / 2
      this.walletLocalData.detailedFeeTable = { updated: Date.now(), low, standard, high }
    })
    .catch(err => console.log(err))

    if (this.electrum && this.electrum.connected) {
      for (const setting in SIMPLE_FEE_SETTINGS) {
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

  async processAddress (address) {
    if (!this.walletLocalData.txIndex[address]) {
      this.walletLocalData.txIndex[address] = { txs: {}, executed: 0, transactionHash: -1 }
    }
    const localTxObject = this.walletLocalData.txIndex[address]
    localTxObject.executed = 0
    const hash = await this.electrum.subscribeToAddress(address)
    await this.handleTransactionStatusHash(address, hash)
    this.updateTick()
  }

  async handleTransactionStatusHash (address, hash) {
    const localTxObject = this.walletLocalData.txIndex[address]
    if (!hash) {
      localTxObject.addressStatusHash = hash
      localTxObject.executed = 1
    }
    if (localTxObject.addressStatusHash === hash) {
      localTxObject.executed = 1
    } else {
      localTxObject.addressStatusHash = hash
      const transactionHashes = await this.electrum.getAddresHistory(address)
      const transactionPromiseArray = transactionHashes.map(rawTransaction => this.handleTransaction(address, rawTransaction))
      const ABCtransaction = await Promise.all(transactionPromiseArray)
      const filtteredABCtransaction = ABCtransaction.filter(tx => tx)
      localTxObject.executed = 1
      this.cacheLocalData()
      this.abcTxLibCallbacks.onTransactionsChanged(filtteredABCtransaction)
    }
  }

  async handleTransaction (address, txId) {
    const localTxObject = this.walletLocalData.txIndex[address]
    const txHash = txId.tx_hash
    let transactionData = localTxObject.txs[txHash]
    if (transactionData && transactionData.executed && transactionData.abcTransaction) {
      if (transactionData.abcTransaction.blockHeight !== txId.height) {
        transactionData.abcTransaction.blockHeight = txId.height
        return transactionData.abcTransaction
      }
      return null
    }
    localTxObject.txs[txHash] = {
      abcTransaction: {},
      executed: 0
    }
    transactionData = localTxObject.txs[txHash]
    const rawTransaction = await this.electrum.getTransaction(txHash)

    const bcoinTX = bcoin.primitives.TX.fromRaw(Buffer.from(rawTransaction, 'hex'))
    const txJson = bcoinTX.getJSON(this.network)
    const ourReceiveAddresses = []
    let nativeAmount = 0
    let totalOutputAmount = 0
    let totalInputAmount = 0

    // Process tx outputs
    txJson.outputs.forEach(({ address, value }) => {
      totalOutputAmount += value
      if (this.walletLocalData.addresses.indexOf(address) !== -1) {
        nativeAmount += value
        ourReceiveAddresses.push(address)
      }
    })
    // Process tx inputs
    const getPrevout = async ({ hash, index }) => {
      const prevRawTransaction = await this.electrum.getTransaction(hash)
      const prevoutBcoinTX = bcoin.primitives.TX.fromRaw(Buffer.from(prevRawTransaction, 'hex'))
      const { value, address } = prevoutBcoinTX.getJSON(this.network).outputs[index]
      totalInputAmount += value
      if (this.walletLocalData.addresses.indexOf(address) !== -1) {
        nativeAmount -= value
      }
    }
    await Promise.all(txJson.inputs.map(({ prevout }) => getPrevout(prevout)))

    const abcTransaction = new ABCTransaction({
      ourReceiveAddresses,
      networkFee: (totalInputAmount - totalOutputAmount).toString(),
      otherParams: {
        rawTx: rawTransaction
      },
      currencyCode: PRIMARY_CURRENCY,
      txid: txHash,
      date: Date.now() / 1000,
      blockHeight: txId.height,
      nativeAmount: nativeAmount.toString(),
      runningBalance: null,
      signedTx: null
    })
    localTxObject.txs[txHash].abcTransaction = abcTransaction
    localTxObject.txs[txHash].executed = 1

    await this.wallet.db.addTX(bcoinTX)
    this.checkGapLimit(address)
    return abcTransaction
  }

  checkGapLimit (address) {
    const total = this.walletLocalData.addresses.length
    const addressIndex = this.walletLocalData.addresses.indexOf(address) + 1
    if (addressIndex + GAP_LIMIT > total) {
      for (let i = 1; i <= addressIndex + GAP_LIMIT - total; i++) {
        this.wallet.createKey(0).then(res => {
          const address = res.getAddress('base58check').toString()
          if (this.walletLocalData.addresses.indexOf(address) === -1) {
            this.txUpdateTotalEntries++
            this.walletLocalData.addresses.push(address)
            this.processAddress(address)
          }
        })
      }
    }
  }

  // //////////////////////////////////////////////////////// NEXT 3 FUNCTIONS NEEDS A MAJOR REWRITE ///////////////////////////////////////////////////////
  // Needs Rewrite
  updateTick () {
    const totalAddresses = this.txUpdateTotalEntries
    var executedAddresses = 0
    var totalTransactions = 0
    var executedTransactions = 0
    for (const i in this.walletLocalData.txIndex) {
      if (!this.walletLocalData.txIndex[i].executed) continue
      executedAddresses++
      for (const j in this.walletLocalData.txIndex[i].txs) {
        if (!this.walletLocalData.txIndex[i].txs[j]) continue
        totalTransactions++
        if (this.walletLocalData.txIndex[i].txs[j].executed) {
          executedTransactions++
        }
      }
    }
    const addressProgress = executedAddresses / totalAddresses
    var transactionProgress = (totalTransactions > 0) ? executedTransactions / totalTransactions : 0
    if (addressProgress === 1 && totalTransactions === 0) {
      transactionProgress = 1
    }
    const totalProgress = addressProgress * transactionProgress
    if (totalProgress === 1 && !this.txUpdateBalanceUpdateStarted) {
      this.txUpdateBalanceUpdateStarted = true
      const getTransactionsAsync = async () => {
        const transactions = await this.getTransactions()
        this.abcTxLibCallbacks.onTransactionsChanged(transactions)
      }
      getTransactionsAsync()
      this.abcTxLibCallbacks.onAddressesChecked(1)
    }
  }

  // Needs rewrite
  async pullBlockHeaders () {
    const newHeadersList = this.getNewHeadersList()
    const prom = []
    const getCallback = (i) => {
      return block => { this.headerList[i] = block }
    }
    for (const i in newHeadersList) {
      prom.push(this.electrum.getBlockHeader(newHeadersList[i]).then(getCallback(newHeadersList[i])))
    }
    await Promise.all(prom)
    if (newHeadersList.length > 1) {
      this.cacheHeadersLocalData()
    }
  }

  // Needs rewrite
  getNewHeadersList () {
    const result = []
    for (const i in this.walletLocalData.txIndex) {
      for (const j in this.walletLocalData.txIndex[i].txs) {
        const h = this.walletLocalData.txIndex[i].txs[j].height
        if (h < 0) continue
        if (!this.headerList[h] && result.indexOf(h) === -1) {
          result.push(h)
        }
      }
    }
    return result
  }
  // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async startEngine () {
    this.electrum = new Electrum(this.electrumServers, this.electrumCallbacks, this.io)
    this.electrum.connect()
    // Needs to replace next 2 lines since it's a super hack //
    const opts = { db: 'memory' }
    if (this.network !== 'main') Object.assign(opts, { network: this.network }) // Hack for now as long as we are using nbcoin version
    // ////////////////////////
    const walletdb = new bcoin.wallet.WalletDB(opts)
    await walletdb.open()

    if (!this.keyInfo.keys) throw new Error('Missing Master Key')
    if (!this.keyInfo.keys.bitcoinKey) throw new Error('Missing Master Key')

    const bitcoinKeyBuffer = Buffer.from(this.keyInfo.keys.bitcoinKey, 'base64')
    const key = bcoin.hd.PrivateKey.fromSeed(bitcoinKeyBuffer, this.network)
    this.wallet = await walletdb.create({
      'master': key.xprivkey(),
      'id': 'ID1'
    })
    const addTXPromises = []
    for (const address in this.walletLocalData.txIndex) {
      const tranasctionsForAddress = this.walletLocalData.txIndex[address].txs
      for (const txHash in tranasctionsForAddress) {
        const transactionData = tranasctionsForAddress[txHash]
        const transactionABCobject = transactionData.abcTransaction
        if (!transactionABCobject && transactionData.data) {
          addTXPromises.push(this.handleTransaction(address, tranasctionsForAddress[txHash].data))
        } else if (transactionABCobject && transactionABCobject.otherParams && transactionABCobject.otherParams.rawTx) {
          const bcoinTX = bcoin.primitives.TX.fromRaw(Buffer.from(tranasctionsForAddress[txHash].abcTransaction.otherParams.rawTx, 'hex'))
          addTXPromises.push(this.wallet.db.addTX(bcoinTX))
        } else {
          addTXPromises.push(this.processAddress(address))
        }
      }
    }
    await Promise.all(addTXPromises)

    this.wallet.on('balance', balance => {
      this.walletLocalData.masterBalance = bns.add(balance.confirmed.toString(), balance.unconfirmed.toString())
      this.abcTxLibCallbacks.onBalanceChanged(PRIMARY_CURRENCY, this.walletLocalData.masterBalance)
      this.cacheLocalData()
    })
    const accountPath = await this.wallet.getAccountPaths(0)
    const checkList = accountPath.map(path => path.toAddress(this.network).toString())
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

  async loadCachedData () {
    try {
      const localWallet = await this.walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(DATA_STORE_FILE)
      .getText()
      this.cachedLocalData = localWallet
      const data = JSON.parse(localWallet)
      Object.assign(this.walletLocalData, data)
      const cachedTransactions = await this.getTransactions()
      this.abcTxLibCallbacks.onTransactionsChanged(cachedTransactions)
      this.electrum.updateCache(data.txIndex)
      if (typeof data.headerList !== 'undefined') this.headerList = data.headerList
      this.abcTxLibCallbacks.onBalanceChanged(PRIMARY_CURRENCY, this.walletLocalData.masterBalance)
    } catch (e) {
      await this.cacheLocalData()
    }
    try {
      const localHeaders = await this.walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(HEADER_STORE_FILE)
      .getText()
      const data = JSON.parse(localHeaders)
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
    if (this.cachedLocalHeaderData !== headerList) {
      await this.walletLocalFolder
      .folder(DATA_STORE_FOLDER)
      .file(HEADER_STORE_FILE)
      .setText(JSON.stringify({
        headerList: this.headerList
      }))
      this.cachedLocalHeaderData = headerList
    }
  }

  async cacheLocalData () {
    const walletJsonStringified = JSON.stringify(this.walletLocalData)
    if (this.cachedLocalData !== walletJsonStringified) {
      await this.walletLocalFolder
        .folder(DATA_STORE_FOLDER)
        .file(DATA_STORE_FILE)
        .setText(walletJsonStringified)
      this.cachedLocalData = walletJsonStringified
    }
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

  objectToArray (obj) {
    return Object.keys(obj).map(key => obj[key])
  }

  getNumTransactions ({currencyCode = PRIMARY_CURRENCY} = {currencyCode: PRIMARY_CURRENCY}) {
    return this.objectToArray(this.walletLocalData.txIndex).reduce((s, addressTxs) => s + Object.keys(addressTxs).length, 0)
  }

  async getTransactions (options) {
    const txIndexArray = this.objectToArray(this.walletLocalData.txIndex)
    const transactions = txIndexArray.reduce((s, addressTxs) => {
      return Object.keys(addressTxs.txs).length ? s.concat(this.objectToArray(addressTxs.txs)) : s
    }, [])
    const abcTransactions = transactions.filter(({ executed }) => executed).map(({ abcTransaction }) => abcTransaction)
    const startIndex = (options && options.startIndex) || 0
    let endIndex = (options && options.numEntries) || abcTransactions.length
    if (startIndex + endIndex > abcTransactions.length) endIndex = abcTransactions.length
    return abcTransactions.slice(startIndex, endIndex)
  }

  getFreshAddress (options = {}) {
    for (let i = 0; i < this.walletLocalData.addresses.length; i++) {
      const address = this.walletLocalData.addresses[i]
      if (!Object.keys(this.walletLocalData.txIndex[address].txs).length) return address
    }
    return false
  }

  isAddressUsed (address, options = {}) {
    const validator = cs.createValidator(this.magicByte)
    if (!validator(address)) throw new Error('Wrong formatted address')
    if (this.walletLocalData.addresses.indexOf(address) === -1) throw new Error('Address not found in wallet')
    if (!this.walletLocalData.txIndex[address]) return false
    return Object.keys(this.walletLocalData.txIndex[address].txs).length !== 0
  }

  async makeSpend (abcSpendInfo) {
    if (!abcSpendInfo.spendTargets) throw new Error('Need to provide Spend Targets')

    const feeOption = abcSpendInfo.networkFeeOption || 'standard'
    let rate, resultedTransaction

    if (feeOption === 'custom') {
      rate = parseInt(abcSpendInfo.customNetworkFee)
    } else {
      rate = this.walletLocalData.detailedFeeTable[feeOption]
    }

    const outputs = abcSpendInfo.spendTargets.map(spendTarget => {
      return new bcoin.primitives.Output({
        value: parseInt(spendTarget.nativeAmount),
        script: bcoin.script.fromAddress(spendTarget.publicAddress)
      })
    })

    const txOptions = { outputs, rate: rate * 1000, maxFee: MAX_FEE }
    try {
      resultedTransaction = await this.wallet.createTX(txOptions)
    } catch (e) {
      if (e.type === 'FundingError') throw new Error('InsufficientFundsError')
      throw e
    }

    const sumOfTx = abcSpendInfo.spendTargets.reduce((s, spendTarget) => s + parseInt(spendTarget.nativeAmount), 0)
    let ourReceiveAddresses = []
    for (const i in resultedTransaction.outputs) {
      const address = resultedTransaction.outputs[i].getAddress()
      if (address && this.walletLocalData.addresses.indexOf(address) !== -1) ourReceiveAddresses.push(address)
    }

    const abcTransaction = new ABCTransaction({
      ourReceiveAddresses,
      otherParams: {
        rawTx: resultedTransaction.toRaw().toString('hex'),
        bcoinTx: resultedTransaction
      },
      currencyCode: PRIMARY_CURRENCY,
      txid: null,
      date: null,
      blockHeight: -1,
      nativeAmount: '-' + (sumOfTx + parseInt(resultedTransaction.getFee())).toString(),
      networkFee: resultedTransaction.getFee().toString(),
      runningBalance: null,
      signedTx: null
    })
    return abcTransaction
  }

  async signTx (abcTransaction) {
    await this.wallet.sign(abcTransaction.otherParams.bcoinTx)
    abcTransaction.date = Date.now() / 1000
    abcTransaction.signedTx = abcTransaction.otherParams.bcoinTx.toRaw()
    return abcTransaction
  }

  async broadcastTx (abcTransaction) {
    if (!abcTransaction.signedTx) throw new Error('Tx is not signed')
    const serverResponse = await this.electrum.broadcastTransaction(abcTransaction.signedTx.toString('hex'))
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
