// @flow

import { bns } from 'biggystring'
import type { Disklet } from 'disklet'
import type {
  EdgeSpendInfo,
  EdgeSpendTarget,
  EdgeTransaction
} from 'edge-core-js/types'
import { InsufficientFundsError } from 'edge-core-js/types'

import { CurrencyEngine } from '../../engine/currencyEngine'
import { CurrencyEngineExtension } from '../../engine/currencyEngineExtension'
import { EngineState } from '../../engine/engineState'
import { EngineStateExtension } from '../../engine/engineStateExtension'
import { KeyManager } from '../../engine/keyManager'
import type { PluginIo } from '../../plugin/pluginIo'
import { getReceiveAddresses, sumUtxos } from '../../utils/coinUtils'
import type { TxOptions } from '../../utils/coinUtils.js'
import { logger } from '../../utils/logger'
import type { PrivateCoin } from '../zcoins'
import { DENOMINATIONS, OP_SIGMA_MINT } from '../zcoins'
import { getMintsToSpend } from './coinOperations'
import {
  createMintBranchPrivateKey,
  createSpendTX,
  getMintCommitmentsForValue,
  parseJsonTransactionForSpend,
  signSpendTX,
  sumTransaction
} from './coinUtils'
import type { SpendCoin } from './coinUtils.js'
import { ZcoinStateExtension } from './zcoinStateExtension'

const MILLI_TO_SEC = 1000

export class ZcoinEngineExtension implements CurrencyEngineExtension {
  currencyEngine: CurrencyEngine
  engineState: EngineState
  walletLocalEncryptedDisklet: Disklet
  keyManager: KeyManager
  io: PluginIo

  engineStateExtensions: EngineStateExtension
  zcoinStateExtensions: ZcoinStateExtension
  savedSpendTransactionValues: { [key: string]: number }

  canRunLoop: boolean
  looperMethods: any
  privateKey: any

  constructor() {
    this.savedSpendTransactionValues = {}
    this.zcoinStateExtensions = new ZcoinStateExtension()
    this.engineStateExtensions = this.zcoinStateExtensions
  }

  async load(currencyEngine: CurrencyEngine) {
    this.currencyEngine = currencyEngine
    this.engineState = this.currencyEngine.engineState
    this.walletLocalEncryptedDisklet = this.currencyEngine.walletLocalEncryptedDisklet
    this.keyManager = this.currencyEngine.keyManager
    this.io = this.currencyEngine.io

    this.runLooperIfNeed()
  }

  async killEngine() {
    this.cancelAllLooperMethods()
  }

  onTxFetched(txid: string) {
    if (txid in this.savedSpendTransactionValues) {
      const edgeTransaction = this.getSpendTransactionSync(
        txid,
        this.savedSpendTransactionValues[txid]
      )
      this.currencyEngine.callbacks.onTransactionsChanged([edgeTransaction])
    } else {
      const edgeTransaction = this.getSpendTransactionSync(
        txid,
        this.getSpendTransactionValues()[txid]
      )
      this.currencyEngine.callbacks.onTransactionsChanged([edgeTransaction])
    }
  }

  async saveTx(edgeTransaction: EdgeTransaction) {
    const { otherParams = {}, txid = '' } = edgeTransaction
    const {
      mintsForSave = [],
      spendCoins = [],
      isSpend = false,
      value = 0
    } = otherParams

    await this.zcoinStateExtensions.appendMintedCoins(mintsForSave)
    await this.zcoinStateExtensions.updateSpendCoins(spendCoins, txid)
    if (isSpend) {
      this.savedSpendTransactionValues[txid] = value
    }
  }

  async loop() {
    const utxos = this.engineState.getUTXOs()
    const needToMint = sumUtxos(utxos)
    let needToMintStr = needToMint.toString()
    if (bns.gt(needToMintStr, DENOMINATIONS[0])) {
      if (
        bns.mul(bns.div(needToMintStr, DENOMINATIONS[0]), DENOMINATIONS[0]) ===
        needToMintStr
      ) {
        // can't mint all balance, because of fee
        needToMintStr = bns.sub(needToMintStr, DENOMINATIONS[0])
      }
      const edgeInfo: EdgeSpendInfo = {
        currencyCode: 'XZC',
        spendTargets: [
          {
            publicAddress: this.keyManager.getChangeAddress(),
            nativeAmount: needToMintStr
          }
        ]
      }
      await this.mint(edgeInfo)
    }

    const updated = await this.updateMintMetadata()
    if (updated) {
      this.currencyEngine.onBalanceChanged()
    }
  }

  runLooperIfNeed() {
    this.canRunLoop = true
    this.addLooperMethodToLoop('loop', 60000)
  }

  cancelAllLooperMethods() {
    this.canRunLoop = false
    for (const looper in this.looperMethods) {
      clearTimeout(this.looperMethods[looper])
    }
  }

  async addLooperMethodToLoop(looperMethod: string, timer: number) {
    try {
      // $FlowFixMe
      await this[looperMethod]()
    } catch (e) {
      logger.error('addLooperMethodToLoop', looperMethod, e)
    }
    if (this.canRunLoop) {
      this.looperMethods[looperMethod] = setTimeout(() => {
        if (this.canRunLoop) {
          this.addLooperMethodToLoop('loop', timer)
        }
      }, timer)
    }
    return true
  }

  async mint(edgeSpendInfo: EdgeSpendInfo) {
    let mintTx: ?EdgeTransaction = null
    let tryAgain = true
    while (tryAgain) {
      tryAgain = false
      try {
        mintTx = await this.makeMint(edgeSpendInfo)
      } catch (e) {
        logger.error('mint', e)
        if (e.message === 'InsufficientFundsError') {
          const amount = edgeSpendInfo.spendTargets[0].nativeAmount || '0'
          if (bns.gt(amount, DENOMINATIONS[0])) {
            edgeSpendInfo.spendTargets[0].nativeAmount = bns.sub(
              amount,
              DENOMINATIONS[0]
            )
            tryAgain = true
          } else {
            return
          }
        } else {
          return
        }
      }
    }
    if (mintTx == null) {
      return
    }

    try {
      const signTx = await this.currencyEngine.signTx(mintTx)
      const broadcastTx = await this.currencyEngine.broadcastTx(signTx)
      await this.currencyEngine.saveTx(broadcastTx)
    } catch (e) {
      logger.error('mint', e)
    }
  }

  async makeMint(
    edgeSpendInfo: EdgeSpendInfo,
    txOptions?: TxOptions = {}
  ): Promise<EdgeTransaction> {
    const { spendTargets } = edgeSpendInfo
    // Can't spend without outputs
    if (!txOptions.CPFP && (!spendTargets || spendTargets.length < 1)) {
      throw new Error('Need to provide Spend Targets')
    }
    // Calculate the total amount to send
    const totalAmountToSend = spendTargets.reduce(
      (sum, { nativeAmount }) => bns.add(sum, nativeAmount || '0'),
      '0'
    )

    // Try and get UTXOs from `txOptions`, if unsuccessful use our own utxo's
    const { utxos = this.engineState.getUTXOs() } = txOptions
    // Test if we have enough to spend
    if (bns.gt(totalAmountToSend, `${sumUtxos(utxos)}`)) {
      throw new InsufficientFundsError()
    }

    try {
      // Get the rate according to the latest fee
      const rate = this.currencyEngine.getRate(edgeSpendInfo)
      logger.info(`spend: Using fee rate ${rate} sat/K`)
      // Create outputs from spendTargets

      const currentMaxIndex = this.zcoinStateExtensions.getLastPrivateCoinIndex()

      const outputs = []
      let mints = []
      for (const spendTarget of spendTargets) {
        const {
          publicAddress: address,
          nativeAmount,
          otherParams: { script } = {}
        } = spendTarget
        const balance = nativeAmount || '0'

        const privateKey = await this.getMintBranchPrivateKey()
        mints = await getMintCommitmentsForValue(
          balance,
          privateKey,
          currentMaxIndex,
          this.io
        )
        mints.forEach(coin => {
          if (address && nativeAmount) {
            outputs.push({ address, value: coin.value })
          } else if (script) {
            outputs.push({ script, value: coin.value })
          }
        })

        mints.forEach(coin => {
          coin.groupId = -1
          coin.isSpend = false
          coin.spendTxId = ''
        })
      }

      const bcoinTx = await this.keyManager.createTX({
        outputs,
        utxos,
        rate,
        txOptions,
        height: this.currencyEngine.getBlockHeight(),
        io: this.io,
        walletInfo: this.currencyEngine.walletInfo
      })

      for (let i = 0; i < outputs.length; i++) {
        const privateCoin = mints[i]
        bcoinTx.outputs[i].address = null
        bcoinTx.outputs[i].script.fromRaw(
          Buffer.concat([
            Buffer.from(OP_SIGMA_MINT, 'hex'),
            Buffer.from(privateCoin.commitment, 'hex')
          ])
        )
      }

      const { scriptHashes } = this.engineState
      const sumOfTx = spendTargets.reduce(
        (s, { publicAddress, nativeAmount }: EdgeSpendTarget) =>
          publicAddress && scriptHashes[publicAddress]
            ? s
            : s - parseInt(nativeAmount),
        0
      )

      const addresses = getReceiveAddresses(
        bcoinTx,
        this.currencyEngine.network
      )

      const ourReceiveAddresses = addresses.filter(
        address => scriptHashes[address]
      )

      const edgeTransaction: EdgeTransaction = {
        ourReceiveAddresses,
        otherParams: {
          txJson: bcoinTx.getJSON(this.currencyEngine.network),
          edgeSpendInfo,
          rate,
          isSpend: false,
          mintsForSave: mints
        },
        currencyCode: this.currencyEngine.currencyCode,
        txid: '',
        date: 0,
        blockHeight: 0,
        nativeAmount: `${sumOfTx - parseInt(bcoinTx.getFee())}`,
        networkFee: `${bcoinTx.getFee()}`,
        signedTx: ''
      }
      return edgeTransaction
    } catch (e) {
      logger.error('makeMint', e)
      if (e.type === 'FundingError') throw new Error('InsufficientFundsError')
      throw e
    }
  }

  async updateMintMetadata(): Promise<boolean> {
    // get saved mint data
    let flag = false
    const mintData: PrivateCoin[] = this.zcoinStateExtensions.mintedCoins

    // process mints
    const mintsToRetrieve = []
    const mintsToUpdate = {}
    mintData.forEach(info => {
      if (info.commitment) {
        mintsToRetrieve.push({ denom: info.value, pubcoin: info.commitment })
        mintsToUpdate[info.commitment] = info
      }
    })

    if (mintsToRetrieve.length > 0) {
      const retrievedData = await this.zcoinStateExtensions.retrieveMintMetadata(
        mintsToRetrieve
      )
      retrievedData.forEach(data => {
        const passHeightLimit =
          this.currencyEngine.getBlockHeight() - data.height >= 5
        flag = flag || passHeightLimit
        mintsToUpdate[data.pubcoin].groupId = passHeightLimit
          ? data.groupId
          : -1
      })
      await this.zcoinStateExtensions.writeMintedCoins(mintData)
    }

    return flag
  }

  async makeSpend(
    edgeSpendInfo: EdgeSpendInfo,
    txOptions?: TxOptions = {}
  ): Promise<EdgeTransaction> {
    const { spendTargets } = edgeSpendInfo
    // Can't spend without outputs
    if (!txOptions.CPFP && (!spendTargets || spendTargets.length < 1)) {
      throw new Error('Need to provide Spend Targets')
    }
    // Calculate the total amount to send
    const totalAmountToSend = spendTargets.reduce(
      (sum, { nativeAmount }) => bns.add(sum, nativeAmount || '0'),
      '0'
    )

    const mintData: PrivateCoin[] = this.zcoinStateExtensions.mintedCoins
    const currentMaxIndex = this.zcoinStateExtensions.getLastPrivateCoinIndex()

    const approvedMints: PrivateCoin[] = []
    mintData.forEach(info => {
      if (info.groupId && info.groupId !== -1 && !info.isSpend) {
        approvedMints.push(info)
      }
    })

    // // Try and get UTXOs from `txOptions`, if unsuccessful use our own utxo's
    let { utxos = this.engineState.getUTXOs() } = txOptions
    utxos = JSON.parse(JSON.stringify(utxos))
    // // Test if we have enough to spend
    // if (bns.gt(totalAmountToSend, `${approvedMintedBalance}`)) {
    //   throw new InsufficientFundsError()
    // }

    const remainder = totalAmountToSend || '0'
    const mintsToBeSpend: PrivateCoin[] = getMintsToSpend(
      approvedMints,
      remainder
    )
    if (mintsToBeSpend.length === 0) {
      throw new Error('InsufficientFundsError')
    }

    const spendCoins: SpendCoin[] = []
    for (const info of mintsToBeSpend) {
      spendCoins.push({
        value: info.value,
        anonymitySet: [], // retrievedData.serializedCoins,
        blockHash: '1', // retrievedData.blockHash,
        index: info.index,
        groupId: info.groupId
      })
    }

    try {
      // Get the rate according to the latest fee
      const rate = this.currencyEngine.getRate(edgeSpendInfo)
      logger.info(`spend: Using fee rate ${rate} sat/K`)
      // Create outputs from spendTargets

      const mintBalance = parseInt(
        this.engineState.getBalance({ mintedBalance: true }),
        10
      )

      for (let i = 0; i < utxos.length; i++) {
        const len = utxos[i].tx.outputs.length
        utxos[i].tx.outputs[len - 1].value = mintBalance
      }

      const outputs = []
      for (const spendTarget of spendTargets) {
        const {
          publicAddress: address,
          nativeAmount,
          otherParams: { script } = {}
        } = spendTarget
        const value = parseInt(nativeAmount || '0')
        if (address && nativeAmount) outputs.push({ address, value })
        else if (script) outputs.push({ script, value })
      }

      const standardOutputs = await this.keyManager.convertToStandardOutputs(
        outputs
      )

      const {
        tx: bcoinTx,
        mints: mintedInTx,
        spendFee,
        value
      } = await createSpendTX({
        mints: spendCoins,
        outputs: standardOutputs,
        changeAddress: this.keyManager.getChangeAddress(),
        network: this.keyManager.network
      })

      const { scriptHashes } = this.engineState
      const sumOfTx = spendTargets.reduce(
        (s, { publicAddress, nativeAmount }: EdgeSpendTarget) =>
          publicAddress && scriptHashes[publicAddress]
            ? s
            : s - parseInt(nativeAmount),
        0
      )

      const addresses = getReceiveAddresses(
        bcoinTx,
        this.currencyEngine.network
      )

      const ourReceiveAddresses = addresses.filter(
        address => scriptHashes[address]
      )

      const edgeTransaction: EdgeTransaction = {
        ourReceiveAddresses,
        otherParams: {
          txJson: bcoinTx.getJSON(this.currencyEngine.network),
          edgeSpendInfo,
          rate,
          isSpend: true,
          mintedInTx,
          spendCoins,
          value,
          currentIndex: currentMaxIndex
        },
        currencyCode: this.currencyEngine.currencyCode,
        txid: '',
        date: 0,
        blockHeight: 0,
        nativeAmount: `${sumOfTx}`,
        networkFee: `${spendFee}`,
        signedTx: ''
      }

      return edgeTransaction
    } catch (e) {
      logger.error('makeSpend', e)
      if (e.type === 'FundingError') throw new Error('InsufficientFundsError')
      throw e
    }
  }

  async signTx(edgeTransaction: EdgeTransaction): Promise<?EdgeTransaction> {
    const { isSpend = false } = edgeTransaction.otherParams || {}
    if (!isSpend) {
      return null
    }

    const { spendCoins, value, currentIndex, txJson } =
      edgeTransaction.otherParams || {}
    const spends: SpendCoin[] = []
    for (const info of spendCoins) {
      const retrievedData = await this.zcoinStateExtensions.retrieveAnonymitySet(
        info.value,
        info.groupId
      )
      // logger.info('zcoinEngineExtension -> retrieveAnonymitySet retrievedData', retrievedData)
      spends.push({
        value: info.value,
        anonymitySet: retrievedData.serializedCoins,
        blockHash: retrievedData.blockHash,
        index: info.index,
        groupId: info.groupId
      })
    }

    const bTx = parseJsonTransactionForSpend(txJson)
    const privateKey = await this.getMintBranchPrivateKey()

    const { signedTx, txid, mintsForSave } = await signSpendTX(
      bTx,
      value,
      currentIndex,
      privateKey,
      spends,
      this.io
    )

    return {
      ...edgeTransaction,
      otherParams: {
        ...edgeTransaction.otherParams,
        mintsForSave,
        spendCoins: spends
      },
      signedTx,
      txid,
      date: Date.now() / MILLI_TO_SEC
    }
  }

  getTransactionSync(txid: string): EdgeTransaction {
    const spendTransactionValues = this.getSpendTransactionValues()
    return this.getSpendTransactionSync(txid, spendTransactionValues[txid])
  }

  getSpendTransactionSync(txid: string, spendValue: number): EdgeTransaction {
    const { height = -1, firstSeen = Date.now() / 1000 } =
      this.engineState.txHeightCache[txid] || {}
    let date = firstSeen
    // If confirmed, we will try and take the timestamp as the date
    if (height && height !== -1) {
      const blockHeight = this.currencyEngine.pluginState.headerCache[
        `${height}`
      ]
      if (blockHeight) {
        date = blockHeight.timestamp
      }
    }

    // Get parsed bcoin tx from engine
    const bcoinTransaction = this.engineState.parsedTxs[txid]
    if (!bcoinTransaction) {
      throw new Error('Transaction not found')
    }

    const {
      fee,
      ourReceiveAddresses,
      nativeAmount,
      isMint: needCustomTxTitle
    } = sumTransaction(
      bcoinTransaction,
      this.currencyEngine.network,
      this.engineState,
      spendValue
    )

    const sizes = bcoinTransaction.getSizes()
    const debugInfo = `Inputs: ${bcoinTransaction.inputs.length}\nOutputs: ${bcoinTransaction.outputs.length}\nSize: ${sizes.size}\nWitness: ${sizes.witness}`
    const edgeTransaction: EdgeTransaction = {
      ourReceiveAddresses,
      currencyCode: this.currencyEngine.currencyCode,
      otherParams: {
        debugInfo,
        needCustomTxTitle
      },
      txid: txid,
      date: date,
      blockHeight: height === -1 ? 0 : height,
      nativeAmount: `${nativeAmount}`,
      networkFee: `${fee}`,
      signedTx: this.engineState.txCache[txid]
    }
    return edgeTransaction
  }

  getSpendTransactionValues(): { [key: string]: number } {
    // Get existing spend transaction ids
    const spendTransactionValues = {}
    const mintData = this.zcoinStateExtensions.mintedCoins
    mintData.forEach(item => {
      if (item.spendTxId) {
        if (!(item.spendTxId in spendTransactionValues)) {
          spendTransactionValues[item.spendTxId] = 0
        }
        spendTransactionValues[item.spendTxId] += item.value
      }
    })

    return spendTransactionValues
  }

  async getMintBranchPrivateKey() {
    if (!this.privateKey) {
      this.privateKey = await createMintBranchPrivateKey(this.keyManager)
    }

    return this.privateKey
  }
}
