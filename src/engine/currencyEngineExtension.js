// @flow

import type { EdgeSpendInfo, EdgeTransaction } from 'edge-core-js/types'

import type { TxOptions } from '../utils/coinUtils.js'
import { CurrencyEngine } from './currencyEngine'
import { EngineStateExtension } from './engineStateExtension'

export interface CurrencyEngineExtension {
  +load: (currencyEngine: CurrencyEngine) => Promise<void>;

  engineStateExtensions?: EngineStateExtension;

  +killEngine?: () => Promise<void>;
  +resyncBlockchain?: () => Promise<void>;
  +loop?: () => Promise<void>;
  +onTxFetched?: (txid: string) => void;
  +onBalanceChanged?: () => void;
  +saveTx?: (edgeTransaction: EdgeTransaction) => Promise<void>;
  +getTransactionSync?: (txid: string) => EdgeTransaction;
  +signTx?: (edgeTransaction: EdgeTransaction) => Promise<?EdgeTransaction>;
  +makeSpend?: (
    edgeSpendInfo: EdgeSpendInfo,
    txOptions?: TxOptions
  ) => Promise<EdgeTransaction>;
}
