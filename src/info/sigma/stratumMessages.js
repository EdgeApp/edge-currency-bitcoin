// @flow

import type {
  OnFailHandler,
  StratumTask
} from '../../stratum/stratumConnection'

export function getMintMetadata(
  mints: { denom: number, pubcoin: string }[],
  onDone: (result: any) => void,
  onFail: OnFailHandler
): StratumTask {
  return {
    method: 'sigma.getmintmetadata',
    params: [{ mints }],
    onDone(reply: any) {
      return onDone(reply)
    },
    onFail
  }
}

export function getAnonymitySet(
  denom: number,
  setId: string,
  onDone: (result: any) => void,
  onFail: OnFailHandler
): StratumTask {
  return {
    method: 'sigma.getanonymityset',
    params: [denom + '', setId],
    onDone(reply: any) {
      return onDone(reply)
    },
    onFail
  }
}

export function getUsedCoinSerials(
  onDone: (result: any) => void,
  onFail: OnFailHandler
): StratumTask {
  return {
    method: 'sigma.getusedcoinserials',
    params: [],
    onDone(reply: any) {
      return onDone(reply)
    },
    onFail
  }
}

export function getLatestCoinIds(
  onDone: (result: any) => void,
  onFail: OnFailHandler
): StratumTask {
  return {
    method: 'sigma.getlatestcoinids',
    params: [],
    onDone(reply: any) {
      return onDone(reply)
    },
    onFail
  }
}

export function fetchTransactionVerbose(
  txid: string,
  onDone: (txData: any) => void,
  onFail: OnFailHandler
): StratumTask {
  return {
    method: 'blockchain.transaction.get',
    params: [txid, true],
    onDone(reply: any) {
      return onDone(reply)
    },
    onFail
  }
}
