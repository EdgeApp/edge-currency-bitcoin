// Replacing native crypto modules for ReactNative
import { Electrum } from './electrum'
import { ABCTransaction } from './abcTransaction'
import { txLibInfo } from './currencyInfoBTC'
import cs from 'coinstring'
import { bns } from 'biggystring'
import bcoin from 'bcoin'

const BufferJS = require('bufferPlaceHolder').Buffer
const GAP_LIMIT = 25
const MAX_FEE = 1000000
const FEE_UPDATE_INTERVAL = 10000
const PRIMARY_CURRENCY = txLibInfo.getInfo.currencyCode

export class BitcoinEngine {
  constructor (io, keyInfo, opts = {}) {
    this.io = io
    this.walletType = keyInfo.type
    this.masterKeys = keyInfo.keys
    this.wallet = null
    this.initialSync = false

    // Only lines to change on engine to add network type based wallet //
    this.network = this.walletType.includes('testnet') ? 'testnet' : 'main'
    this.magicByte = this.network === 'testnet' ? 0x6F : 0x00
    // /////////////////////////////////////////////////////////////// //

    this.abcTxLibCallbacks = opts.callbacks
    this.walletLocalFolder = opts.walletLocalFolder
    if (!this.walletLocalFolder) throw new Error('Cannot create and engine without a local folder')

    // Loads All of this properties into "this":
    // electrumServers: List of electrum servers to connect to
    // feeInfoServer: The server to get fee from (21fee)
    // diskPath: An Object with contains the following items
    // -  dataStoreFolder: The folder to store all data to disk
    // -  dataStoreFiles: File names for different types of cache
    // simpleFeeSettings: Settings for simple fee algorithem
    Object.assign(this, txLibInfo.getInfo.defaultsSettings)
    // If user provided optional settings and wants to overide the defaults
    if (opts.optionalSettings && opts.optionalSettings.enableOverrideServers) {
      Object.assign(this, opts.optionalSettings)
    }

    // Objects to load and save from disk
    this.headerList = {}
    this.walletLocalData = {
      masterBalance: '0',
      blockHeight: 0,
      addresses: [],
      detailedFeeTable: {},
      simpleFeeTable: {}
    }
    this.transactions = {}
    this.transactionsIds = []
    // // // // // // // // // // // // //

    this.electrumCallbacks = {
      onAddressStatusChanged: this.handleTransactionStatusHash.bind(this),
      onBlockHeightChanged: this.onBlockHeightChanged.bind(this)
    }
  }

  static async makeEngine (io, keyInfo, opts = {}) {
    const engine = new BitcoinEngine(io, keyInfo, opts)
    await engine.loadWalletLocalDataFromDisk()
    await engine.loadTransactionsIdsFromDisk()
    return engine
  }
  /* --------------------------------------------------------------------- */
  /* ---------------------------  Public API  ---------------------------- */
  /* --------------------------------------------------------------------- */
  updateSettings (opts) {
    if (opts.electrumServers) {
      this.electrumServers = opts.electrumServers
      this.electrum = new Electrum(this.electrumServers, this.electrumCallbacks, this.io)
      this.electrum.connect()
    }
  }

  async startEngine () {
    if (!this.masterKeys) throw new Error('Missing Master Key')
    if (!this.masterKeys.bitcoinKey) throw new Error('Missing Master Key')
    // Needs to replace next 2 lines since it's a super hack //
    const opts = { db: 'memory' }
    if (this.network !== 'main') Object.assign(opts, { network: this.network }) // Hack for now as long as we are using nbcoin version
    // ////////////////////////
    const walletdb = new bcoin.wallet.WalletDB(opts)
    await walletdb.open()

    const bitcoinKeyBuffer = BufferJS.from(this.masterKeys.bitcoinKey, 'base64')
    const key = bcoin.hd.PrivateKey.fromSeed(bitcoinKeyBuffer, this.network)
    const masterPath = this.walletType.includes('44') ? null : 'm/0'
    const masterIndex = !masterPath ? null : 32

    this.wallet = await walletdb.create({
      'master': key.xprivkey(),
      'id': 'ID1',
      masterPath,
      masterIndex
    })
    if (!this.walletLocalData.blockHeight) await this.loadWalletLocalDataFromDisk()
    if (!this.transactionsIds.length) await this.loadTransactionsIdsFromDisk()
    await this.loadTransactionsFromDisk()
    await this.loadHeadersFromDisk()

    const transactions = await this.getTransactions()
    const addTXPromises = transactions.map(transaction => {
      const bcoinTX = bcoin.primitives.TX.fromRaw(BufferJS.from(transaction.otherParams.rawTx, 'hex'))
      return this.wallet.add(bcoinTX)
    })
    await Promise.all(addTXPromises)

    this.wallet.on('balance', balance => {
      const confirmedBalance = balance.confirmed.toString()
      const unconfirmedBalance = balance.unconfirmed.toString()
      this.walletLocalData.masterBalance = bns.add(confirmedBalance, unconfirmedBalance)
      this.abcTxLibCallbacks.onBalanceChanged(PRIMARY_CURRENCY, this.walletLocalData.masterBalance)
      this.saveToDisk('walletLocalData')
    })
    const accountPath = await this.wallet.getAccountPaths(0)
    const checkList = accountPath.map(path => path.toAddress(this.network).toString())
    for (let l in checkList) {
      if (this.walletLocalData.addresses.indexOf(checkList[l]) === -1) {
        this.walletLocalData.addresses = checkList
        break
      }
    }
    this.electrum = new Electrum(this.electrumServers, this.electrumCallbacks, this.io)
    this.electrum.connect()
    this.walletLocalData.addresses.forEach(address => this.processAddress(address))
    this.electrum.subscribeToBlockHeight().then(blockHeight => {
      this.onBlockHeightChanged(blockHeight)
    })

    if (!Object.keys(this.walletLocalData.detailedFeeTable).length) await this.updateFeeTable()
    else this.updateFeeTable()
    this.feeUpdater = setInterval(() => this.updateFeeTable(), FEE_UPDATE_INTERVAL)
  }

  async killEngine () {
    this.electrum = null
    clearInterval(this.feeUpdater)
    await this.saveToDisk('headerList')
    await this.saveToDisk('walletLocalData')
    await this.saveToDisk('transactions')
    await this.saveToDisk('transactionsIds')
    return true
  }

  getBlockHeight () {
    return this.walletLocalData.blockHeight
  }

  getBalance (options) {
    return this.walletLocalData.masterBalance
  }

  getNumTransactions ({currencyCode = PRIMARY_CURRENCY} = {currencyCode: PRIMARY_CURRENCY}) {
    return this.objectToArray(this.transactions).reduce((s, addressTxs) => {
      return s + Object.keys(addressTxs).length
    }, 0)
  }

  async getTransactions (options) {
    const txIndexArray = this.objectToArray(this.transactions)
    const transactions = txIndexArray.reduce((s, addressTxs) => {
      if (Object.keys(addressTxs.txs).length) {
        return s.concat(this.objectToArray(addressTxs.txs))
      } else return s
    }, [])
    const abcTransactions = transactions
      .filter(({ executed }) => executed)
      .map(({ abcTransaction }) => abcTransaction)
    const startIndex = (options && options.startIndex) || 0
    let endIndex = (options && options.numEntries) || abcTransactions.length
    if (startIndex + endIndex > abcTransactions.length) {
      endIndex = abcTransactions.length
    }
    return abcTransactions.slice(startIndex, endIndex)
  }

  getFreshAddress (options = {}) {
    for (let i = 0; i < this.walletLocalData.addresses.length; i++) {
      const address = this.walletLocalData.addresses[i]
      if (!Object.keys(this.transactions[address].txs).length) return address
    }
    return false
  }

  addGapLimitAddresses (addresses) {
    addresses.forEach(address => this.checkGapLimit(address))
  }

  isAddressUsed (address, options = {}) {
    const validator = cs.createValidator(this.magicByte)
    if (!validator(address)) throw new Error('Wrong formatted address')
    if (this.walletLocalData.addresses.indexOf(address) === -1) {
      throw new Error('Address not found in wallet')
    }
    if (!this.transactions[address]) return false
    return Object.keys(this.transactions[address].txs).length !== 0
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

    const sumOfTx = abcSpendInfo.spendTargets.reduce((s, spendTarget) => {
      if (this.walletLocalData.addresses.indexOf(spendTarget.publicAddress) !== -1) {
        return s
      } else return s - parseInt(spendTarget.nativeAmount)
    }, 0)

    let ourReceiveAddresses = []
    for (const i in resultedTransaction.outputs) {
      const address = resultedTransaction.outputs[i].getAddress()
      if (address && this.walletLocalData.addresses.indexOf(address) !== -1) {
        ourReceiveAddresses.push(address)
      }
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
      nativeAmount: (sumOfTx - parseInt(resultedTransaction.getFee())).toString(),
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
    const signedTxRawString = abcTransaction.signedTx.toString('hex')
    const serverResponse = await this.electrum.broadcastTransaction(signedTxRawString)
    if (!serverResponse) throw new Error('Electrum server internal error processing request')
    if (serverResponse === 'TX decode failed') throw new Error('Tx is not valid')
    return serverResponse
  }

  async saveTx (abcTransaction) {
    const tx = bcoin.primitives.TX.fromRaw(abcTransaction.signedTx)
    await this.wallet.db.addTX(tx)
  }
  /* --------------------------------------------------------------------- */
  /* --------------------  Experimantal Public API  ---------------------- */
  /* --------------------------------------------------------------------- */
  async getTransactionsByIds (transactionsIds) {
    const allTransactions = await this.getTransactions()
    return allTransactions.filter(({ txid }) => transactionsIds.indexOf(txid) !== -1)
  }

  async getTransactionsIds () {
    return this.transactionsIds
  }
  /* --------------------------------------------------------------------- */
  /* ---------------------------  Private API  --------------------------- */
  /* --------------------------------------------------------------------- */
  objectToArray (obj) {
    return Object.keys(obj).map(key => obj[key])
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
      for (const setting in this.simpleFeeSettings) {
        this.electrum.getEstimateFee(this.simpleFeeSettings[setting])
        .then(fee => {
          if (fee !== -1) {
            this.walletLocalData.simpleFeeTable[setting] = { updated: Date.now(), fee }
          }
        })
        .catch(err => console.log(err))
      }
    }
  }

  onBlockHeightChanged (blockHeight) {
    if (this.walletLocalData.blockHeight < blockHeight) {
      this.walletLocalData.blockHeight = blockHeight
      this.abcTxLibCallbacks.onBlockHeightChanged(blockHeight)
      this.saveToDisk('walletLocalData')
    }
  }

  async processAddress (address) {
    if (!this.transactions[address]) {
      this.transactions[address] = { txs: {}, addressStatusHash: null }
    }
    this.transactions[address].executed = 0
    const hash = await this.electrum.subscribeToAddress(address)
    if (hash && hash !== this.transactions[address].addressStatusHash) {
      await this.handleTransactionStatusHash(address, hash)
    }
    this.transactions[address].executed = 1
    if (!this.initialSync &&
      this.walletLocalData.addresses.length === Object.keys(this.transactions).length
    ) {
      let finishedLoading = true
      for (const address in this.transactions) {
        if (!this.transactions[address].executed) {
          finishedLoading = false
          break
        }
      }
      if (finishedLoading) {
        this.abcTxLibCallbacks.onAddressesChecked(1)
        this.initialSync = true
      }
    }
  }

  async handleTransactionStatusHash (address, hash) {
    const localTxObject = this.transactions[address]
    localTxObject.addressStatusHash = hash
    const transactionHashes = await this.electrum.getAddresHistory(address)
    const transactionPromiseArray = transactionHashes.map(transactionObject => {
      return this.handleTransaction(address, transactionObject)
    })
    const ABCtransaction = await Promise.all(transactionPromiseArray)
    const filtteredABCtransaction = ABCtransaction.filter(tx => tx)
    const updatedTransactionIds = []
    filtteredABCtransaction.forEach(({ txid }) => {
      updatedTransactionIds.push(txid)
      if (this.transactionsIds.indexOf(txid) === -1) this.transactionsIds.push(txid)
    })
    this.saveToDisk('transactions')
    this.saveToDisk('transactionsIds')
    if (this.abcTxLibCallbacks.onTxidsChanged) {
      this.abcTxLibCallbacks.onTxidsChanged(updatedTransactionIds)
    }
    this.abcTxLibCallbacks.onTransactionsChanged(filtteredABCtransaction)
  }

  async handleTransaction (address, transactionObj) {
    const localTxObject = this.transactions[address]
    const txHash = transactionObj.tx_hash
    let transactionData = localTxObject.txs[txHash]
    if (transactionData && transactionData.executed && transactionData.abcTransaction) {
      if (transactionData.abcTransaction.blockHeight !== transactionObj.height) {
        transactionData.abcTransaction.blockHeight = transactionObj.height
        return transactionData.abcTransaction
      }
      return null
    }
    localTxObject.txs[txHash] = {
      abcTransaction: {},
      executed: 0
    }
    transactionData = localTxObject.txs[txHash]
    let rawTransaction
    if (this.transactionsIds.indexOf(txHash) !== -1) {
      const abcTransactionsArray = await this.getTransactionsByIds([txHash])
      if (abcTransactionsArray.length === 1) {
        rawTransaction = abcTransactionsArray[0].otherParams.rawTx
      }
    }
    rawTransaction = rawTransaction || await this.electrum.getTransaction(txHash)
    const bcoinTX = bcoin.primitives.TX.fromRaw(BufferJS.from(rawTransaction, 'hex'))
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
      const prevoutBcoinTX = bcoin.primitives.TX.fromRaw(BufferJS.from(prevRawTransaction, 'hex'))
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
      blockHeight: transactionObj.height,
      nativeAmount: nativeAmount.toString(),
      runningBalance: null,
      signedTx: null
    })
    localTxObject.txs[txHash].abcTransaction = abcTransaction
    localTxObject.txs[txHash].executed = 1

    await this.wallet.add(bcoinTX)
    await this.checkGapLimit(address)
    return abcTransaction
  }

  async checkGapLimit (address) {
    const total = this.walletLocalData.addresses.length
    const addressIndex = this.walletLocalData.addresses.indexOf(address) + 1
    if (addressIndex + GAP_LIMIT > total) {
      for (let i = 1; i <= addressIndex + GAP_LIMIT - total; i++) {
        const newAddressObj = await this.wallet.createKey(0)
        const newAddress = newAddressObj.getAddress('base58check').toString()
        if (this.walletLocalData.addresses.indexOf(newAddress) === -1) {
          this.walletLocalData.addresses.push(newAddress)
          this.processAddress(newAddress)
        }
      }
    }
  }
  /* --------------------------------------------------------------------- */
  /* ----------------------------  Needs Fix  ---------------------------- */
  /* --------------------------------------------------------------------- */
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
      this.saveToDisk('headerList')
    }
  }

  getNewHeadersList () {
    const result = []
    for (const i in this.transactions) {
      for (const j in this.transactions[i].txs) {
        const h = this.transactions[i].txs[j].height
        if (h < 0) continue
        if (!this.headerList[h] && result.indexOf(h) === -1) {
          result.push(h)
        }
      }
    }
    return result
  }
  /* --------------------------------------------------------------------- */
  /* -----------------------  Disk Util Functions  ----------------------- */
  /* --------------------------------------------------------------------- */
  async saveToDisk (fileName, optionalFileName = '') {
    try {
      await this.walletLocalFolder
      .folder(this.diskPath.folder)
      .file(this.diskPath.files[fileName] + optionalFileName)
      .setText(JSON.stringify(this[fileName]))
    } catch (e) {
      return e
    }
  }

  async loadFromDisk (fileName, optionalFileName = '') {
    try {
      const data = await this.walletLocalFolder
      .folder(this.diskPath.folder)
      .file(this.diskPath.files[fileName] + optionalFileName)
      .getText()
      let dataJson = JSON.parse(data)
      Object.assign(this[fileName], dataJson)
      return dataJson
    } catch (e) {
      return null
    }
  }

  async loadWalletLocalDataFromDisk () {
    const localWalletData = await this.loadFromDisk('walletLocalData')
    if (localWalletData) {
      this.abcTxLibCallbacks.onBalanceChanged(PRIMARY_CURRENCY, this.walletLocalData.masterBalance)
    } else await this.saveToDisk('walletLocalData')
  }

  async loadTransactionsFromDisk () {
    const transactions = await this.loadFromDisk('transactions')
    if (transactions) {
      const transactionsFromFile = await this.getTransactions()
      this.abcTxLibCallbacks.onTransactionsChanged(transactionsFromFile)
    } else await this.saveToDisk('transactions')
  }

  async loadTransactionsIdsFromDisk () {
    const transactionsIds = await this.loadFromDisk('transactionsIds')
    if (transactionsIds) {
      if (this.abcTxLibCallbacks.onTxidsChanged) {
        this.abcTxLibCallbacks.onTxidsChanged(transactionsIds)
      }
    } else await this.saveToDisk('transactionsIds')
  }

  async loadHeadersFromDisk () {
    const headers = await this.loadFromDisk('headerList')
    if (!headers) await this.saveToDisk('headerList')
  }
}
