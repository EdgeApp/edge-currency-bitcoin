// @flow

import { type Disklet } from 'disklet'
import {
  type EdgeCurrencyEngineOptions,
  type EdgeWalletInfo
} from 'edge-core-js/types'
import { type HDKeyPair } from 'nidavellir'

import { type PluginState } from '../src/plugin/pluginState.js'
import {
  type Output,
  type ScriptHashMap,
  type TxOptions,
  type Utxo
} from './bcoinUtils.js'
import { type PluginIo } from './plugin.js'

export type EngineCurrencyInfo = {
  // Required Settings
  network: string, // The offical network in lower case - Needs to match the Bitcoin Lib Network Type
  currencyCode: string, // The offical currency code in upper case - Needs to match the EdgeCurrencyInfo currencyCode
  maxFee: number,
  electrumServersUrl: string,
  networkFeesUrl: string,
  defaultFee: number,
  feeUpdateInterval: number,
  customFeeSettings: Array<string>,
  simpleFeeSettings: {
    highFee: string,
    lowFee: string,
    standardFeeLow: string,
    standardFeeHigh: string,
    standardFeeLowAmount: string,
    standardFeeHighAmount: string
  },

  // Optional Settings
  forks?: Array<string>,
  feeInfoServer?: string
}

export type CurrencyEngineSettings = {
  walletInfo: EdgeWalletInfo,
  engineInfo: EngineCurrencyInfo,
  pluginState: PluginState,
  options: EdgeCurrencyEngineOptions,
  io: PluginIo
}

export type UtxoInfo = {
  txid: string, // tx_hash from Stratum
  index: number, // tx_pos from Stratum
  value: number // Satoshis fit in a number
}

export type AddressInfo = {
  txids: Array<string>,
  utxos: Array<UtxoInfo>,
  used: boolean, // Set manually by `addGapLimitAddress`
  displayAddress: string, // base58 or other wallet-ready format
  path: string, // TODO: Define the contents of this member.
  balance: number,
  redeemScript?: string
}

export type AddressInfos = {
  [scriptHash: string]: AddressInfo
}

export type AddressState = {
  subscribed: boolean,
  synced: boolean,

  hash: string | null,
  // Timestamp of the last hash change.
  // The server with the latest timestamp "owns" an address for the sake
  // of fetching utxos and txids:
  lastUpdate: number,

  fetchingUtxos: boolean,
  fetchingTxids: boolean,
  subscribing: boolean
}

export interface EngineStateCallbacks {
  // Changes to an address UTXO set:
  +onBalanceChanged?: () => void;

  // Changes to an address 'use' state:
  +onAddressUsed?: () => void;

  // Changes to the chain height:
  +onHeightUpdated?: (height: number) => void;

  // Fetched a transaction from the network:
  +onTxFetched?: (txid: string) => void;

  // Called when the engine gets more synced with electrum:
  +onAddressesChecked?: (progressRatio: number) => void;
}

export interface EngineStateOptions {
  callbacks: EngineStateCallbacks;
  io: PluginIo;
  localDisklet: Disklet;
  encryptedLocalDisklet: Disklet;
  pluginState: PluginState;
  walletId?: string;
}

export type createTxOptions = {
  outputs?: Array<Output>,
  utxos: Array<Utxo>,
  height: number,
  rate: number,
  maxFee: number,
  txOptions: TxOptions
}

export type SignMessage = {
  message: string,
  address: string
}

export type KeyManagerOptions = {
  account?: number,
  coinType?: number,
  masterKey?: HDKeyPair,
  seed?: string,
  xpub?: string,
  gapLimit: number,
  network: string,
  addressInfos?: AddressInfos,
  scriptHashes?: { [displayAddress: string]: string },
  scriptHashesMap?: ScriptHashMap,
  txInfos?: { [txid: string]: any },
  bips?: Array<number>
}
