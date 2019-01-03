// @flow

export type RawTx = string
export type BlockHeight = number
export type Txid = string

export type Script = {
  type: string,
  params?: Array<string>
}

export type Output = {
  address?: string,
  script?: Script,
  value: number
}

export type StandardOutput = {
  address: string,
  value: number
}

export type Utxo = {
  tx: any,
  index: number,
  height?: BlockHeight
}

export type TxOptions = {
  utxos?: Array<Utxo>,
  setRBF?: boolean,
  RBFraw?: RawTx,
  CPFP?: Txid,
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
  outputs?: Array<StandardOutput>,
  height?: BlockHeight,
  estimate?: Function,
  txOptions: TxOptions
}

export type DerivedAddress = {
  address: string,
  scriptHash: string,
  redeemScript?: string
}
export type BranchName = string

export type Branches = {
  [branchNum: string]: BranchName
}

export type DerivationConfig = {
  nested: boolean,
  witness: boolean,
  branches: Branches,
  bipNumber: number,
  scriptTemplates: any
}

export type AddressBranch = {
  index?: number,
  path?: string,
  nested?: boolean,
  witness?: boolean,
  scriptType?: string | ((...settings: any) => string),
  purpose: string
}

export type branchSettings = {
  path: (...settings: any) => string,
  branchNumber: number,
  nested: boolean,
  witness: boolean,
  scriptType: string | ((...settings: any) => string),
  addresses: Array<AddressBranch>
}

export type BranchesSettings = {
  [bipNumber: string]: branchSettings
}
