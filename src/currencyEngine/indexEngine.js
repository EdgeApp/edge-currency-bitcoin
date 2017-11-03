// @flow

import { Electrum } from '../electrumWrapper/indexElectrum'
import { bns } from 'biggystring'
import { validate } from 'jsonschema'

import type {
  AbcCurrencyPluginCallbacks,
  AbcCurrencyEngine,
  AbcWalletInfo,
  AbcMakeEngineOptions,
  AbcTransaction,
  AbcSpendTarget,
  AbcFreshAddress,
  AbcSpendInfo
} from 'airbitz-core-types'

// $FlowFixMe
const BufferJS = require('bufferPlaceHolder').Buffer
const crypto = require('crypto')
const RECONNECTION_INTERVAL = 10000
const MILI_TO_SEC = 1000
const BYTES_TO_KB = 1000

function validateObject (object, schema) {
  const result = validate(object, schema)

  if (result.errors.length === 0) {
    return true
  } else {
    for (const n in result.errors) {
      const errMsg = result.errors[n].message
      console.log('ERROR: validateObject:' + errMsg)
    }
    return false
  }
}

type WalletLocalData = {
  masterBalance: string,
  blockHeight: number,
  addresses: {
    receive: Array<any>,
    change: Array<any>,
    nested: Array<any>
  },
  detailedFeeTable: any,
  simpleFeeTable: any
}

export default (bcoin:any, txLibInfo:any) => class CurrencyEngine implements AbcCurrencyEngine {
  walletLocalFolder: any
  io: any
  walletType: string
  masterKeys: any
  network: string
  wallet: any
  headerList: any
  primaryCurrency: string
  abcTxLibCallbacks: AbcCurrencyPluginCallbacks
  walletLocalData: WalletLocalData
  transactions: any
  transactionsIds: Array<any>
  memoryDump: any
  gapLimit: number
  electrumServers: Array<Array<string>>
  electrum: Electrum
  feeUpdater:any
  feeUpdateInterval: number
  maxFee: number
  defaultFee: number
  defaultDenomMultiplier: number
  simpleFeeSettings: any
  feeInfoServer: string
  currencyName: string
  diskPath: {
    folder: any,
    files: any
  }
  electrumCallbacks: {
    onAddressStatusChanged (address: string, hash: string):Promise<void>,
    onBlockHeightChanged (height: number):void,
    onDisconnect ():void
  }
  constructor (io:any, keyInfo:AbcWalletInfo, opts: AbcMakeEngineOptions) {
    if (!opts.walletLocalFolder) throw new Error('Cannot create and engine without a local folder')
    this.walletLocalFolder = opts.walletLocalFolder
    this.io = io
    this.walletType = keyInfo.type
    this.masterKeys = keyInfo.keys
    this.currencyName = txLibInfo.getInfo.currencyName.toLowerCase()
    if (this.masterKeys) {
      this.masterKeys.currencyKey = keyInfo.keys[`${this.currencyName}Key`]
    }
    this.network = keyInfo.type.includes('testnet') ? 'testnet' : 'main'
    this.wallet = null
    this.primaryCurrency = txLibInfo.getInfo.currencyCode
    this.defaultDenomMultiplier = txLibInfo.getInfo.denominations.reduce((result, denom) =>
      denom.name === this.primaryCurrency ? parseInt(denom.multiplier) : result
    , 1)
    this.abcTxLibCallbacks = opts.callbacks

    // Loads All of this properties into "this":
    // electrumServers: List of electrum servers to connect to
    // feeInfoServer: The server to get fee from (21fee)
    // diskPath: An Object with contains the following items
    // -  dataStoreFolder: The folder to store all data to disk
    // -  dataStoreFiles: File names for different types of cache
    // simpleFeeSettings: Settings for simple fee algorithem
    // gapLimit: How many addresses we use as gap,
    // maxFee: Maximum transaction fee per byte,
    // feeUpdateInterval: Interval to update fee in miliseconds,
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
      addresses: {
        receive: [],
        change: [],
        nested: []
      },
      detailedFeeTable: {
        updated: 0
      },
      simpleFeeTable: {}
    }
    this.transactions = {}
    this.transactionsIds = []
    this.memoryDump = {}
    // // // // // // // // // // // // //

    this.electrumCallbacks = {
      onAddressStatusChanged: this.onTransactionStatusHash.bind(this),
      onBlockHeightChanged: this.onBlockHeightChanged.bind(this),
      onDisconnect: this.onDisconnect.bind(this)
    }
  }

  static async makeEngine (io:any, keyInfo: AbcWalletInfo, opts: AbcMakeEngineOptions): Promise<AbcCurrencyEngine> {
    const engine = new CurrencyEngine(io, keyInfo, opts)
    await engine.startWallet()
    return engine
  }

  async startWallet () {
    if (!this.masterKeys) throw new Error('Missing Master Key')
    if (!this.masterKeys.currencyKey) throw new Error('Missing Master Key')

    const walletDbOptions = {
      network: this.network,
      memDbRaw: null
    }

    await this.loadFromDisk(this.memoryDump, 'memoryDump')

    if (this.memoryDump.rawMemory) {
      walletDbOptions.memDbRaw = BufferJS.from(this.memoryDump.rawMemory, 'hex')
    }

    const walletdb = new bcoin.wallet.WalletDB(walletDbOptions)
    await walletdb.open()

    let key = null

    try {
      const mnemonic = bcoin.hd.Mnemonic.fromPhrase(this.masterKeys.currencyKey)
      key = bcoin.hd.PrivateKey.fromMnemonic(mnemonic, this.network)
    } catch (e) {
      const keyBuffer = BufferJS.from(this.masterKeys.currencyKey, 'base64')
      key = bcoin.hd.PrivateKey.fromSeed(keyBuffer, this.network)
    }

    if (this.memoryDump.rawMemory) {
      try {
        this.wallet = await walletdb.get('ID1')
        this.wallet.importMasterKey({master: key.xprivkey()})
      } catch (e) {}
    }
    if (!this.wallet) {
      const masterPath = this.walletType.includes('44') ? null : 'm/0/0'
      const masterIndex = !masterPath ? null : 32
      this.wallet = await walletdb.create({
        'master': key.xprivkey(),
        'id': 'ID1',
        secureMode: true,
        witness: this.walletType.includes('segwit'),
        masterPath,
        masterIndex
      })
      await this.wallet.setLookahead(0, this.gapLimit)
      await this.saveMemDumpToDisk()
    }
    await this.syncDiskData()
  }

  async syncDiskData () {
    const props = ['walletLocalData', 'transactions', 'transactionsIds', 'headerList']
    const loadFromDiskPromise = props.map(key =>
      // $FlowFixMe
      this.loadFromDisk(this[key], key).then(result => !result ? this.saveToDisk(this[key], key) : true)
    )
    await Promise.all(loadFromDiskPromise)
    this.electrum = new Electrum(this.electrumServers, this.electrumCallbacks, this.io, this.walletLocalData.blockHeight)
    if (!this.memoryDump) {
      const transactions = await this.getTransactions()
      const addTXPromises = transactions.map(transaction => {
        const bcoinTX = bcoin.primitives.TX.fromRaw(BufferJS.from(transaction.otherParams.rawTx, 'hex'))
        return this.wallet.add(bcoinTX)
      })
      await Promise.all(addTXPromises)
    }

    await this.syncAddresses()
  }

  async syncAddresses () {
    const account = await this.wallet.getAccount(0)
    const receiveDepth = account.receiveDepth - 1 + this.gapLimit
    const changeDepth = account.changeDepth - 1 + this.gapLimit
    const nestedDepth = account.nestedDepth - 1 + this.gapLimit
    const addresses = this.walletLocalData.addresses
    if (receiveDepth > addresses.receive.length ||
      (this.walletType.includes('44') && changeDepth > addresses.change.length)) {
      const accountPaths = await this.wallet.getPaths(0)
      const newAddresses = {
        receive: [],
        change: [],
        nested: []
      }
      for (let i in accountPaths) {
        switch (accountPaths[i].branch) {
          case 0:
            if (receiveDepth > addresses.receive.length) {
              newAddresses.receive.push(accountPaths[i].toAddress(this.network).toString())
            }
            break
          case 1:
            if (this.walletType.includes('44') && changeDepth > addresses.change.length) {
              newAddresses.change.push(accountPaths[i].toAddress(this.network).toString())
            }
            break
          case 2:
            if (this.walletType.includes('segwit') && nestedDepth > addresses.nested.length) {
              newAddresses.nested.push(accountPaths[i].toAddress(this.network).toString())
            }
            break
        }
      }
      if (newAddresses.receive.length > addresses.receive.length) {
        addresses.receive = newAddresses.receive
      }
      if (this.walletType.includes('44')) {
        if (newAddresses.change.length > addresses.change.length) {
          addresses.change = newAddresses.change
        }
      }
      if (this.walletType.includes('segwit')) {
        if (newAddresses.nested.length > addresses.nested.length) {
          addresses.nested = newAddresses.nested
        }
      }
    }
    if (!this.memoryDump.rawMemory) {
      await this.saveMemDumpToDisk()
    }
  }
  /* --------------------------------------------------------------------- */
  /* ---------------------------  Public API  ---------------------------- */
  /* --------------------------------------------------------------------- */
  updateSettings (opts:any) {
    if (opts.electrumServers) {
      this.electrumServers = opts.electrumServers
      this.electrum = new Electrum(this.electrumServers, this.electrumCallbacks, this.io, this.walletLocalData.blockHeight)
      this.electrum.connect()
    }
  }

  async startEngine () {
    this.wallet.on('balance', balance => {
      const confirmedBalance = balance.confirmed.toString()
      const unconfirmedBalance = balance.unconfirmed.toString()
      this.walletLocalData.masterBalance = bns.add(confirmedBalance, unconfirmedBalance)
      this.abcTxLibCallbacks.onBalanceChanged(this.primaryCurrency, this.walletLocalData.masterBalance)
      this.saveToDisk(this.walletLocalData, 'walletLocalData')
    })
    const transactions = await this.getTransactions()
    if (transactions && transactions.length) this.abcTxLibCallbacks.onTransactionsChanged(transactions)
    if (this.walletLocalData.masterBalance !== '0') {
      this.abcTxLibCallbacks.onBalanceChanged(this.primaryCurrency, this.walletLocalData.masterBalance)
    }
    this.electrum.connect()
    this.getAllOurAddresses().forEach(address => {
      this.subscribeToAddress(address).then(() => {
        this.initialSyncCheck()
      })
    })

    if (!Object.keys(this.walletLocalData.detailedFeeTable).length) {
      await this.updateFeeTable()
    } else {
      this.updateFeeTable()
    }
    this.feeUpdater = setInterval(() => this.updateFeeTable(), this.feeUpdateInterval)
  }

  async killEngine () {
    this.electrum.stop()
    clearInterval(this.feeUpdater)
    await this.saveMemDumpToDisk()
    await this.saveToDisk(this.headerList, 'headerList')
    await this.saveToDisk(this.walletLocalData, 'walletLocalData')
    await this.saveToDisk(this.transactions, 'transactions')
    await this.saveToDisk(this.transactionsIds, 'transactionsIds')
  }

  getBlockHeight ():number {
    return this.walletLocalData.blockHeight
  }

  getBalance (options:any):string {
    return this.walletLocalData.masterBalance
  }

  getNumTransactions (options:any):number {
    return this.objectToArray(this.transactions).reduce((s, addressTxs) => {
      return s + Object.keys(addressTxs).length
    }, 0)
  }

  async enableTokens (tokens: Array<string>) {
    if (tokens.length > 0) {
      throw new Error('TokenUnsupported')
    }
  }

  getTokenStatus (token:string): boolean {
    return false
  }

  async getTransactions (options:any): Promise<Array<AbcTransaction>> {
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

  getFreshAddress (options: any): AbcFreshAddress {
    let freshAddress = { publicAddress: null }
    for (let i = 0; i < this.walletLocalData.addresses.receive.length; i++) {
      const address = this.walletLocalData.addresses.receive[i]
      if (!Object.keys(this.transactions[address].txs).length) {
        freshAddress.publicAddress = address
        break
      }
    }
    if (!freshAddress.publicAddress) throw Error('ErrorNoFreshAddresses')
    if (this.walletType.includes('segwit')) {
      freshAddress.segwitAddress = freshAddress.publicAddress
      freshAddress.publicAddress = null
      for (let i = 0; i < this.walletLocalData.addresses.nested.length; i++) {
        const address = this.walletLocalData.addresses.nested[i]
        if (!Object.keys(this.transactions[address].txs).length) {
          freshAddress.publicAddress = address
          break
        }
      }
      if (!freshAddress.publicAddress) throw Error('ErrorNoFreshAddresses')
    }
    return freshAddress
  }

  addGapLimitAddresses (addresses:Array<string>) {
    addresses.forEach(async address => {
      const path = await this.wallet.getPath(address)
      const account = await this.wallet.getAccount(0)
      switch (path.branch) {
        case 0:
          if (path.index + this.gapLimit > account.receiveDepth) {
            account.syncDepth(path.index + this.gapLimit)
            await this.checkGapLimitForBranch(account, 'receive', 0)
          }
          break
        case 1:
          if (this.walletType.includes('44') && path.index + this.gapLimit > account.changeDepth) {
            account.syncDepth(0, path.index + this.gapLimit)
            await this.checkGapLimitForBranch(account, 'change', 1)
          }
          break
        case 2:
          if (this.walletType.includes('segwit') && path.index + this.gapLimit > account.nestedDepth) {
            account.syncDepth(0, 0, path.index + this.gapLimit)
            await this.checkGapLimitForBranch(account, 'nested', 2)
          }
          break
      }
    })
  }

  isAddressUsed (address: string, options: any) {
    try {
      bcoin.primitives.Address.fromBase58(address)
    } catch (e) {
      try {
        bcoin.primitives.Address.fromBech32(address)
      } catch (e) {
        throw new Error('Wrong formatted address')
      }
    }
    if (this.getAllOurAddresses().indexOf(address) === -1) {
      throw new Error('Address not found in wallet')
    }
    if (!this.transactions[address]) {
      return false
    }
    return Object.keys(this.transactions[address].txs).length !== 0
  }

  async makeSpend (abcSpendInfo: AbcSpendInfo) {
    const valid = validateObject(abcSpendInfo, {
      'type': 'object',
      'properties': {
        'currencyCode': { 'type': 'string' },
        'networkFeeOption': { 'type': 'string' },
        'spendTargets': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'currencyCode': { 'type': 'string' },
              'publicAddress': { 'type': 'string' },
              'nativeAmount': { 'type': 'string' },
              'destMetadata': { 'type': 'object' },
              'destWallet': { 'type': 'object' }
            },
            'required': [
              'publicAddress'
            ]
          }
        }
      },
      'required': [ 'spendTargets' ]
    })

    if (!valid) {
      throw (new Error('Error: invalid AbcSpendInfo'))
    }

    // Ethereum can only have one output
    if (abcSpendInfo.spendTargets.length < 1) {
      throw (new Error('Need to provide Spend Targets'))
    }

    const feeOption = abcSpendInfo.networkFeeOption || 'standard'
    let rate, resultedTransaction

    if (feeOption === 'custom') {
      // customNetworkFee is in sat/Bytes in need to be converted to sat/KB
      rate = parseInt(abcSpendInfo.customNetworkFee) * BYTES_TO_KB
    } else {
      // defualt fees are in sat/KB
      rate = this.getRate(feeOption)
    }

    const outputs = abcSpendInfo.spendTargets.map(spendTarget => {
      return new bcoin.primitives.Output({
        value: parseInt(spendTarget.nativeAmount),
        script: bcoin.script.fromAddress(spendTarget.publicAddress)
      })
    })

    // Rate is in sat/KB
    const txOptions = { outputs, rate, maxFee: this.maxFee }
    try {
      resultedTransaction = await this.wallet.createTX(txOptions)
    } catch (e) {
      if (e.type === 'FundingError') throw new Error('InsufficientFundsError')
      throw e
    }
    const allOurAddresses = this.getAllOurAddresses()
    const sumOfTx = abcSpendInfo.spendTargets.reduce((s, spendTarget: AbcSpendTarget) => {
      if (spendTarget.publicAddress &&
        allOurAddresses.indexOf(spendTarget.publicAddress) !== -1) {
        return s
      } else return s - parseInt(spendTarget.nativeAmount)
    }, 0)

    let ourReceiveAddresses = []
    for (const i in resultedTransaction.outputs) {
      const address = resultedTransaction.outputs[i].getAddress().toString(this.network)
      if (address && allOurAddresses.indexOf(address) !== -1) {
        ourReceiveAddresses.push(address)
      }
    }

    const abcTransaction: AbcTransaction = {
      ourReceiveAddresses,
      otherParams: {
        rawTx: resultedTransaction.toRaw().toString('hex'),
        bcoinTx: resultedTransaction,
        abcSpendInfo,
        rate
      },
      currencyCode: this.primaryCurrency,
      txid: '',
      date: 0,
      blockHeight: 0,
      nativeAmount: (sumOfTx - parseInt(resultedTransaction.getFee())).toString(),
      networkFee: resultedTransaction.getFee().toString(),
      signedTx: ''
    }
    return abcTransaction
  }

  async signTx (abcTransaction:AbcTransaction):Promise<AbcTransaction> {
    await this.wallet.sign(abcTransaction.otherParams.bcoinTx)
    abcTransaction.date = Date.now() / MILI_TO_SEC
    abcTransaction.signedTx = abcTransaction.otherParams.bcoinTx.toRaw().toString('hex')
    return abcTransaction
  }

  async broadcastTx (abcTransaction:AbcTransaction):Promise<AbcTransaction> {
    if (!abcTransaction.signedTx) throw new Error('Tx is not signed')
    if (!this.electrum) throw new Error('Uninitialized electrum servers')
    try {
      const serverResponse = await this.electrum.broadcastTransaction(abcTransaction.signedTx)
      if (serverResponse === 'TX decode failed') throw new Error('Tx is not valid')
      abcTransaction.txid = serverResponse
      abcTransaction.ourReceiveAddresses.forEach(address => {
        this.transactions[address].txs[abcTransaction.txid] = {
          abcTransaction,
          executed: 1
        }
      })
      return abcTransaction
    } catch (e) {
      console.log(e)
      if (e.message && e.message.includes('66: ')) {
        const feeInSatBytes = parseInt(abcTransaction.otherParams.rate) / BYTES_TO_KB
        abcTransaction.otherParams.abcSpendInfo.customNetworkFee = feeInSatBytes * 1.5
        abcTransaction.otherParams.abcSpendInfo.networkFeeOption = 'custom'
        const newAbcTransaction = await this.makeSpend(abcTransaction.otherParams.abcSpendInfo)
        const newSignedAbcTransaction = await this.signTx(newAbcTransaction)
        const broadcastTx = await this.broadcastTx(newSignedAbcTransaction)
        return broadcastTx
      }
      throw new Error('Electrum server internal error processing request:' + e.message)
    }
  }

  async saveTx (abcTransaction:AbcTransaction):Promise<void> {
    await this.wallet.add(abcTransaction.otherParams.bcoinTx.toTX())
  }
  /* --------------------------------------------------------------------- */
  /* --------------------  Experimantal Public API  ---------------------- */
  /* --------------------------------------------------------------------- */
  async getTransactionsByIds (transactionsIds:Array<string>): Promise<Array<AbcTransaction>> {
    const allTransactions = await this.getTransactions()
    return allTransactions.filter(({ txid }) => transactionsIds.indexOf(txid) !== -1)
  }

  async getTransactionsIds (): Promise<Array<string>> {
    return this.transactionsIds
  }
  /* --------------------------------------------------------------------- */
  /* ---------------------------  Private API  --------------------------- */
  /* --------------------------------------------------------------------- */
  getAllOurAddresses (): Array<string> {
    let allOurAddresses = []
    for (const typed in this.walletLocalData.addresses) {
      allOurAddresses = allOurAddresses.concat(this.walletLocalData.addresses[typed])
    }
    return allOurAddresses
  }

  objectToArray (obj:any): Array<any> {
    return Object.keys(obj).map(key => obj[key])
  }

  updateFeeTable () {
    if (this.feeInfoServer !== '' &&
      this.walletLocalData.detailedFeeTable.updated < Date.now() - this.feeUpdateInterval) {
      this.io.fetch(this.feeInfoServer)
      .then(res => res.json())
      .then(({ fees }) => {
        let high = fees[fees.length - 1].minFee
        for (let i = fees.length - 1; i >= 0; i--) {
          if (fees[i].maxDelay !== 0) break
          high = fees[i].minFee
        }
        // Results are in sat/bytes and should be converted to sat/KB
        high *= BYTES_TO_KB
        let low = fees[0].minFee
        const highestMaxDelay = fees[0].maxDelay
        for (let i = 1; i < fees.length; i++) {
          low = fees[i].minFee
          if (fees[i].maxDelay < highestMaxDelay) break
        }
        // Results are in sat/bytes and should be converted to sat/KB
        low *= BYTES_TO_KB
        const standard = (low + high) / 2
        this.walletLocalData.detailedFeeTable = { updated: Date.now(), low, standard, high }
      })
      .catch(err => console.log(err))
    }

    for (const setting in this.simpleFeeSettings) {
      if (!this.walletLocalData.simpleFeeTable[setting]) {
        this.walletLocalData.simpleFeeTable[setting] = { updated: 0, fee: this.defaultFee }
      }
      if (this.walletLocalData.simpleFeeTable[setting].updated < Date.now() - this.feeUpdateInterval) {
        this.electrum.getEstimateFee(this.simpleFeeSettings[setting])
        .then(fee => {
          if (fee !== -1) {
            this.walletLocalData.simpleFeeTable[setting].updated = Date.now()
            // Results are in sat/KB
            this.walletLocalData.simpleFeeTable[setting].fee = Math.floor(fee * this.defaultDenomMultiplier)
          }
        })
        .catch(err => console.log(err))
      }
    }
  }

  getRate (feeOption: string) {
    if (this.walletLocalData.detailedFeeTable[feeOption]) return this.walletLocalData.detailedFeeTable[feeOption]
    if (this.walletLocalData.simpleFeeTable[feeOption]) return this.walletLocalData.simpleFeeTable[feeOption].fee
  }

  onBlockHeightChanged (header: any) {
    const blockHeight = header.block_height
    if (this.walletLocalData.blockHeight < blockHeight) {
      this.walletLocalData.blockHeight = blockHeight
      this.abcTxLibCallbacks.onBlockHeightChanged(blockHeight)
      this.saveToDisk(this.walletLocalData, 'walletLocalData')
    }
  }

  onDisconnect () {
    setTimeout(() => {
      this.electrum.connect()
      this.getAllOurAddresses().forEach(address => this.subscribeToAddress(address))
    }, RECONNECTION_INTERVAL)
  }

  addressToScriptHash (address: string) {
    const script = bcoin.script.fromAddress(address)
    const scriptRaw = script.toRaw()
    const scriptHash = crypto.createHash('sha256').update(scriptRaw).digest().toString('hex')
    // $FlowFixMe
    const reversedScriptHash = scriptHash.match(/../g).reverse().join('')
    return reversedScriptHash
  }

  scriptHashToAddress (scriptHash: string) {
    for (const address in this.transactions) {
      if (this.transactions[address].scriptHash === scriptHash) {
        return address
      }
    }
    return ''
  }

  async subscribeToAddress (address: string) {
    if (!this.transactions[address]) {
      const scriptHash = this.addressToScriptHash(address)
      this.transactions[address] = { txs: {}, addressStatusHash: null, scriptHash }
    }
    this.transactions[address].executed = 0
    const scriptHash = this.transactions[address].scriptHash
    let hash = null
    try {
      if (this.walletType.includes('segwit')) {
        hash = await this.electrum.subscribeToScriptHash(scriptHash)
      } else {
        hash = await this.electrum.subscribeToAddress(address)
      }
    } catch (e) { console.log(e) }
    if (hash && hash !== this.transactions[address].addressStatusHash) {
      try {
        await this.onTransactionStatusHash(scriptHash, hash)
      } catch (e) { console.log(e) }
    }
    this.transactions[address].executed = 1
  }

  initialSyncCheck () {
    if (this.getAllOurAddresses().length === Object.keys(this.transactions).length) {
      let finishedLoading = true
      for (const address in this.transactions) {
        if (!this.transactions[address].executed) {
          finishedLoading = false
          break
        }
      }
      finishedLoading && this.abcTxLibCallbacks.onAddressesChecked(1)
    }
  }

  async onTransactionStatusHash (scriptHash: string, hash: string) {
    const address = this.scriptHashToAddress(scriptHash)
    const localTxObject = this.transactions[address]
    localTxObject.addressStatusHash = hash
    try {
      const transactionHashes = await this.electrum.getScriptHashHistory(scriptHash)
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
      this.saveMemDumpToDisk()
      this.saveToDisk(this.transactions, 'transactions')
      this.saveToDisk(this.transactionsIds, 'transactionsIds')
      if (typeof this.abcTxLibCallbacks.onTxidsChanged === 'function') {
        this.abcTxLibCallbacks.onTxidsChanged(updatedTransactionIds)
      }
      this.abcTxLibCallbacks.onTransactionsChanged(filtteredABCtransaction)
    } catch (e) {
      console.log(e)
    }
  }

  async handleTransaction (address: string, transactionObj: any) {
    const localTxObject = this.transactions[address]
    const txHash = transactionObj.tx_hash
    let transactionData = localTxObject.txs[txHash]
    if (transactionData && transactionData.executed && transactionData.abcTransaction) {
      if (transactionData.abcTransaction.blockHeight !== transactionObj.height) {
        transactionData.abcTransaction.blockHeight = transactionObj.height
        const blockHeader = await this.getBlockHeader(transactionObj.height)
        transactionData.abcTransaction.date = blockHeader.timestamp
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
    if (!rawTransaction) {
      try {
        rawTransaction = await this.electrum.getTransaction(txHash)
        const blockHeader = transactionObj.height ? await this.getBlockHeader(transactionObj.height) : null
        const date = blockHeader ? blockHeader.timestamp : Date.now() / MILI_TO_SEC
        const bcoinTX = bcoin.primitives.TX.fromRaw(BufferJS.from(rawTransaction, 'hex'))
        const txJson = bcoinTX.getJSON(this.network)
        const ourReceiveAddresses = []
        let nativeAmount = 0
        let totalOutputAmount = 0
        let totalInputAmount = 0
        const allOurAddresses = this.getAllOurAddresses()
        // Process tx outputs
        txJson.outputs.forEach(({ address, value }) => {
          totalOutputAmount += value
          if (allOurAddresses.indexOf(address) !== -1) {
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
          if (allOurAddresses.indexOf(address) !== -1) {
            nativeAmount -= value
          }
        }
        await Promise.all(txJson.inputs.map(({ prevout }) => getPrevout(prevout)))
        await this.wallet.add(bcoinTX)
        const abcTransaction: AbcTransaction = {
          ourReceiveAddresses,
          networkFee: (totalInputAmount - totalOutputAmount).toString(),
          otherParams: {
            rawTx: rawTransaction
          },
          currencyCode: this.primaryCurrency,
          txid: txHash,
          date,
          blockHeight: transactionObj.height,
          nativeAmount: nativeAmount.toString(),
          signedTx: ''
        }
        localTxObject.txs[txHash].abcTransaction = abcTransaction
        localTxObject.txs[txHash].executed = 1
        await this.checkGapLimit(address)
        return abcTransaction
      } catch (e) {
        console.log(e)
        return null
      }
    }
  }

  async checkGapLimit (address: string) {
    const account = await this.wallet.getAccount(0)
    const path = await this.wallet.getPath(address)
    switch (path.branch) {
      case 0:
        this.checkGapLimitForBranch(account, 'receive', 0)
        break
      case 1:
        if (this.walletType.includes('44')) {
          this.checkGapLimitForBranch(account, 'receive', 1)
        }
        break
      case 2:
        if (this.walletType.includes('segwit')) {
          this.checkGapLimitForBranch(account, 'nested', 2)
        }
        break
    }
  }

  async checkGapLimitForBranch (account:any, type: string, typeNum: number) {
    const addresses = this.walletLocalData.addresses[type]
    const addressDepth = account[`${type}Depth`] - 1 + this.gapLimit
    const addressesLen = addresses.length
    if (addressDepth > addressesLen) {
      const paths = await this.wallet.getPaths(0)
      paths
      .filter(path => path.branch === typeNum && path.index > addressesLen)
      .forEach(path => {
        const address = path.toAddress(this.network).toString()
        addresses.push(address)
        this.subscribeToAddress(address)
      })
    }
  }

  async getBlockHeader (height: number): any {
    if (this.headerList[height]) {
      return this.headerList[height]
    }
    let header
    try {
      header = await this.electrum.getBlockHeader(height)
      this.headerList[height] = header
      this.saveToDisk(this.headerList, 'headerList')
      return header
    } catch (e) {
      return null
    }
  }
  /* --------------------------------------------------------------------- */
  /* -----------------------  Disk Util Functions  ----------------------- */
  /* --------------------------------------------------------------------- */
  async saveToDisk (obj: any, fileName: string, optionalFileName: string = '') {
    try {
      await this.walletLocalFolder
      .folder(this.diskPath.folder)
      .file(this.diskPath.files[fileName] + optionalFileName)
      .setText(JSON.stringify(obj))
    } catch (e) {
      return e
    }
  }

  async saveMemDumpToDisk () {
    if (this.wallet &&
      this.wallet.db &&
      this.wallet.db.db &&
      this.wallet.db.db.binding &&
      this.wallet.db.db.binding.toRaw) {
      this.memoryDump.rawMemory = this.wallet.db.db.binding.toRaw().toString('hex')
      await this.saveToDisk(this.memoryDump, 'memoryDump')
    }
  }

  async loadFromDisk (obj:any, fileName: string, optionalFileName: string = '') {
    try {
      const data = await this.walletLocalFolder
      .folder(this.diskPath.folder)
      .file(this.diskPath.files[fileName] + optionalFileName)
      .getText()
      let dataJson = JSON.parse(data)
      Object.assign(obj, dataJson)
      return dataJson
    } catch (e) {
      return null
    }
  }

  async loadMemoryDumpFromDisk () {
    const memoryDump = await this.loadFromDisk(this.memoryDump, 'memoryDump')
    if (!memoryDump) await this.saveMemDumpToDisk()
  }
}
