// @flow

import type { Disklet } from 'disklet'

import { EngineState } from '../../engine/engineState'
import { EngineStateExtension } from '../../engine/engineStateExtension'
import type { StratumTask } from '../../stratum/stratumConnection'
import { logger } from '../../utils/logger'
import {
  type PrivateCoin,
  asPrivateCoinArray,
  SIGMA_ENCRYPTED_FILE
} from '../zcoins'
import { type SpendCoin } from './coinUtils'
import {
  fetchTransactionVerbose,
  getAnonymitySet,
  getLatestCoinIds,
  getMintMetadata,
  getUsedCoinSerials
} from './stratumMessages'

export type AnonymitySet = {
  blockHash: string,
  serializedCoins: string[]
}

export type UsedSerials = {
  serials: string[]
}

export type CoinGroup = {
  denom: number,
  id: number,
  anonymitySet: string[]
}

export type MintMetadata = {
  pubcoin: string,
  groupId: number,
  height: number
}

export class ZcoinStateExtension implements EngineStateExtension {
  engineState: EngineState
  encryptedLocalDisklet: Disklet

  // Transactions that are relevant to our addresses, but missing locally and must retrieved with details:
  missingTxsVerbose: { [txid: string]: true }
  mintedCoins: PrivateCoin[]

  mintsToRetrieve: ?({ denom: number, pubcoin: string }[])
  retrievedMints: ?(MintMetadata[])

  anonymitySetToRetrieve: ?{ denom: number, groupId: number }
  retrievedAnonymitySet: ?AnonymitySet

  usedSerials: ?UsedSerials
  retrievedUsedSerials: ?boolean

  coinGroup: ?(CoinGroup[])
  retrievedCoinGroup: ?boolean

  constructor() {
    this.missingTxsVerbose = {}
  }

  handleNewTxid(txid: string, verbose: boolean) {
    if (verbose) {
      this.missingTxsVerbose[txid] = true
    }
  }

  async load(engineState: EngineState) {
    this.engineState = engineState
    this.encryptedLocalDisklet = this.engineState.encryptedLocalDisklet

    // update the spend transactions
    this.mintedCoins = await this.loadMintedCoins()
    this.mintedCoins.forEach(item => {
      if (item.spendTxId) {
        this.handleNewTxid(item.spendTxId, true)
      }
    })
  }

  pickNextTask(uri: string, stratumVersion: string): StratumTask | void {
    const serverState = this.engineState.serverStates[uri]
    const prefix = `${this.engineState.walletId} ${uri.replace(
      'electrum://',
      ''
    )}:`

    for (const txid of Object.keys(this.missingTxsVerbose)) {
      if (this.engineState.serverCanGetTx(uri, txid)) {
        delete this.missingTxsVerbose[txid]
        const queryTime = Date.now()
        return fetchTransactionVerbose(
          txid,
          txData => {
            logger.info(`${prefix} ** RECEIVED MISSING VERBOSE TX ** ${txid}`)
            this.engineState.pluginState.serverScoreUp(
              uri,
              Date.now() - queryTime
            )
            this.engineState.handleTxFetch(txid, txData.hex)
            this.engineState.handleTxidFetch(txid, txData.height)
          },
          (e: Error) => {
            if (!serverState.txids[txid]) {
              this.engineState.handleMessageError(
                uri,
                `getting verbose transaction ${txid}`,
                e
              )
            } else {
              // TODO: Don't penalize the server score either.
            }
          }
        )
      }
    }

    if (this.needRequestMints()) {
      return this.requestMintsFromStratum(uri, stratumVersion)
    }

    if (this.needRequestAnonymitySet()) {
      return this.requestAnonymitySetFromStratum(uri, stratumVersion)
    }

    if (this.needRequestUsedSerials()) {
      return this.requestUsedSerialsFromStratum(uri, stratumVersion)
    }

    if (this.needRequestCoinGroup()) {
      return this.requestCoinGroupFromStratum(uri, stratumVersion)
    }
  }

  needRequestMints() {
    return this.mintsToRetrieve
  }

  requestMintsFromStratum(uri: string, stratumVersion: string) {
    if (!this.mintsToRetrieve) {
      return
    }

    const mints = this.mintsToRetrieve
    this.mintsToRetrieve = null
    return getMintMetadata(
      mints.map(info => {
        return { denom: info.denom, pubcoin: info.pubcoin }
      }),
      result => {
        this.retrievedMints = mints.map((info, index) => {
          const response = result[index]
          let groupId = -1
          let height = -1
          try {
            height = Object.keys(response)[0]
            groupId = response[height]
          } catch (e) {}

          return { pubcoin: info.pubcoin, groupId, height: Number(height) }
        })
      },
      (e: Error) => {
        this.retrievedMints = []
        this.engineState.handleMessageError(
          uri,
          'Failed getting mint metadata',
          e
        )
      }
    )
  }

  needRequestAnonymitySet() {
    return this.anonymitySetToRetrieve
  }

  requestAnonymitySetFromStratum(uri: string, stratumVersion: string) {
    if (!this.anonymitySetToRetrieve) {
      return
    }

    const denom = this.anonymitySetToRetrieve.denom
    const groupId = this.anonymitySetToRetrieve.groupId
    this.anonymitySetToRetrieve = null
    return getAnonymitySet(
      denom,
      groupId + '',
      result => {
        this.retrievedAnonymitySet = result
      },
      (e: Error) => {
        this.retrievedAnonymitySet = { blockHash: '', serializedCoins: [] }
        this.engineState.handleMessageError(
          uri,
          'Failed getting anonymity set',
          e
        )
      }
    )
  }

  needRequestUsedSerials() {
    return this.retrievedUsedSerials
  }

  requestUsedSerialsFromStratum(uri: string, stratumVersion: string) {
    this.retrievedUsedSerials = false
    return getUsedCoinSerials(
      result => {
        this.usedSerials = result
      },
      (e: Error) => {
        this.usedSerials = { serials: [] }
        this.engineState.handleMessageError(
          uri,
          'Failed getting used coin serials',
          e
        )
      }
    )
  }

  needRequestCoinGroup() {
    return this.retrievedCoinGroup
  }

  requestCoinGroupFromStratum(uri: string, stratumVersion: string) {
    this.retrievedCoinGroup = false
    return getLatestCoinIds(
      result => {
        this.coinGroup = result
      },
      (e: Error) => {
        this.coinGroup = []
        this.engineState.handleMessageError(
          uri,
          'Failed getting used coin serials',
          e
        )
      }
    )
  }

  retrieveMintMetadata(
    mints: { denom: number, pubcoin: string }[]
  ): Promise<MintMetadata[]> {
    return new Promise((resolve, reject) => {
      this.mintsToRetrieve = mints
      this.retrievedMints = null

      const checkResponse = () => {
        if (this.retrievedMints) {
          resolve(this.retrievedMints)
        } else {
          // wake up connections
          this.wakeUpConnections()
          setTimeout(checkResponse, 2000)
        }
      }
      checkResponse()
    })
  }

  retrieveAnonymitySet(denom: number, groupId: number): Promise<AnonymitySet> {
    return new Promise((resolve, reject) => {
      this.anonymitySetToRetrieve = { denom, groupId }
      this.retrievedAnonymitySet = null

      const checkResponse = () => {
        if (this.retrievedAnonymitySet) {
          resolve(this.retrievedAnonymitySet)
        } else {
          // wake up connections
          this.wakeUpConnections()
          setTimeout(checkResponse, 2000)
        }
      }
      checkResponse()
    })
  }

  retrieveUsedCoinSerials(): Promise<UsedSerials> {
    return new Promise((resolve, reject) => {
      this.retrievedUsedSerials = true
      this.usedSerials = null

      const checkResponse = () => {
        if (this.usedSerials) {
          resolve(this.usedSerials)
        } else {
          // wake up connections
          this.wakeUpConnections()
          setTimeout(checkResponse, 2000)
        }
      }
      checkResponse()
    })
  }

  retrieveLatestCoinIds(): Promise<CoinGroup[]> {
    return new Promise((resolve, reject) => {
      this.retrievedCoinGroup = true
      this.coinGroup = null

      const checkResponse = () => {
        if (this.coinGroup) {
          resolve(this.coinGroup)
        } else {
          // wake up connections
          this.wakeUpConnections()
          setTimeout(checkResponse, 2000)
        }
      }
      checkResponse()
    })
  }

  getLastPrivateCoinIndex() {
    return this.mintedCoins.reduce((acc, coin) => {
      return Math.max(coin.index, acc)
    }, 0)
  }

  // TODO: change json struct
  async loadMintedCoins(): Promise<PrivateCoin[]> {
    let mints: PrivateCoin[] = []
    try {
      const jsonString = await this.encryptedLocalDisklet.getText(
        SIGMA_ENCRYPTED_FILE
      )
      mints = asPrivateCoinArray(JSON.parse(jsonString))
    } catch (e) {
      logger.error('loadMintedCoins', e)
    }

    this.mintedCoins = mints
    return mints
  }

  // TODO: change json struct
  async writeMintedCoins(mints: PrivateCoin[]) {
    const json = JSON.stringify(mints)
    await this.encryptedLocalDisklet.setText(SIGMA_ENCRYPTED_FILE, json)
    this.mintedCoins = mints

    return this.mintedCoins
  }

  async appendMintedCoins(coins: PrivateCoin[]): Promise<PrivateCoin[]> {
    const newMintedCoins = [...this.mintedCoins, ...coins]

    const wroteCoins = await this.writeMintedCoins(newMintedCoins)
    return wroteCoins
  }

  async updateSpendCoins(coins: SpendCoin[], txid: string) {
    const mints = this.mintedCoins
    coins.forEach(coin => {
      for (let i = 0; i < mints.length; ++i) {
        const mint = mints[i]
        if (mint.index === coin.index) {
          mint.isSpend = true
          mint.spendTxId = txid
          mint.groupId = coin.groupId
          break
        }
      }
    })

    this.writeMintedCoins(mints)
  }

  wakeUpConnections() {
    Object.keys(this.engineState.connections).forEach(uri => {
      this.engineState.connections[uri].doWakeUp()
    })
  }
}
