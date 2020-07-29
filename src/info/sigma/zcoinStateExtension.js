// @flow

import type { Disklet } from 'disklet'

import { EngineState } from '../../engine/engineState'
import { EngineStateExtension } from '../../engine/engineStateExtension'
import type { StratumTask } from '../../stratum/stratumConnection'
import { logger } from '../../utils/logger'
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

  wakeUpConnections() {
    Object.keys(this.engineState.connections).forEach(uri => {
      this.engineState.connections[uri].doWakeUp()
    })
  }
}
