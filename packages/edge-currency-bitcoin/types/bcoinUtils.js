// @flow

import { type HexPair, type ScriptType } from 'nidavellir'

export type EdgeAddress = { [scriptType: ScriptType]: string }
export type RawAddress = {
  type: ScriptType,
  hash: string,
  version: number
}
export type Address = {
  displayAddress: string,
  scriptHash: string,
  redeemScript?: string
}
export type Addresses = { [path: string]: Address }
export type AddressesMap = { [parentPath: string]: Addresses }
export type ScriptHashMap = { [parentPath: string]: Array<string> }

export type ScriptTypeSettings = {
  type: string,
  version: number,
  getHash: (data: string) => string,
  getData: (k?: HexPair, s?: string) => string
}

export type Script = {
  type: string,
  params?: Array<string>
}

export type Output = {
  address?: string,
  script?: Script,
  value: number
}

export type Utxo = {
  tx: any,
  index: number,
  height?: number
}

export type TxOptions = {
  utxos?: Array<Utxo>,
  setRBF?: boolean,
  RBFraw?: string,
  CPFP?: string,
  CPFPlimit?: number,
  selection?: string,
  subtractFee?: boolean
}

export type CreateTxOptions = {
  utxos: Array<Utxo>,
  rate: number,
  maxFee: number,
  changeAddress: string,
  network: string,
  outputs?: Array<Output>,
  height?: number,
  estimate?: Function,
  txOptions: TxOptions
}

export type BcoinHDConf = {
  nested: boolean,
  witness: boolean
}

export type KeyRings = Array<{
  publicKey: string,
  scriptType: ScriptType,
  privateKey?: string,
  redeemScript?: string
}>
