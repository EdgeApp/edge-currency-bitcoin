// @flow

export type BcoinHDPrivateKey = Object | null
export type BcoinHDPublicKey = Object
export type Base58String = string
export type ScriptType = string
export type RawTx = string
export type BlockHeight = number
export type Txid = string
export type HDKeyType = 'privateKey' | 'publicKey' | 'address'
export type Addresses = { [path: string]: string }

export type ReplayProtection = {
  SIGHASH_FORKID: number,
  forcedMinVersion: number,
  forkId: number
}
export type KeyPrefix = {
  privkey: number,
  xpubkey: number,
  xprivkey: number,
  xpubkey58: string,
  xprivkey58: string,
  coinType: number
}

export type AddressPrefix = {
  pubkeyhash: number,
  scripthash: number,
  cashAddress?: string,
  pubkeyhashLegacy?: number,
  scripthashLegacy?: number,
  witnesspubkeyhash?: number,
  witnessscripthash?: number,
  bech32?: string
}

export type NetworkInfo = {
  type: string,
  magic: number,
  supportedBips: Array<number>,
  keyPrefix: KeyPrefix,
  addressPrefix: AddressPrefix,
  forks?: Array<string>,
  replayProtection?: ReplayProtection
}

export type Address = {
  displayAddress: Base58String,
  scriptHash: string,
  redeemScript?: string
}

export type Base58KeyPair = {
  priv?: Base58String,
  pub: Base58String
}

export type BcoinHDKeyPair = {
  priv?: BcoinHDPrivateKey,
  pub: BcoinHDPublicKey
}

export type HDSettings = {
  [path: string]: {
    keyType: HDKeyType,
    getPath?: (...settings: any) => string,
    scriptType?: ScriptType,
    children?: HDSettings
  }
}

export type KeyTree<KeyPair> = {
  key?: KeyPair,
  keyType: HDKeyType,
  path: string,
  children: { [childRelativePath: string]: KeyTree<KeyPair> },
  address?: Address,
  scriptType?: ScriptType
}

export type HDKey = KeyTree<BcoinHDKeyPair>
export type HDMasterKey = { key: BcoinHDKeyPair } & HDKey
export type Base58Key = KeyTree<Base58KeyPair>
export type KeyPair = Base58KeyPair | BcoinHDKeyPair

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

export type NetworkSettings = {
  hdSettings: HDSettings,
  scriptTemplates: Object,
  forks: Array<string>,
  supportedBips: Array<number>,
  serializers: Object,
  addressPrefix: AddressPrefix,
  keyPrefix: KeyPrefix
}

export type KeySettings = {
  seed: string,
  network: string,
  account: number,
  coinType: number
}
export type BcoinHDConf = {
  nested: boolean,
  witness: boolean
}
