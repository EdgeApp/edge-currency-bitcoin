// @flow

export type Alphabet = [string, string] | string
export type BaseDecoder = {
  encode: (hexStr: string) => string,
  decode: (baseStr: string) => string
}
export type BaseCheck = BaseDecoder & { check: BaseDecoder }
export type Bases = { [baseName: string]: BaseCheck }

export type Encoder<T> = {
  input: (data: T) => any,
  output: (rest: any) => T
}

export type FunctionFormatterOptions = {
  numParams?: number,
  sync?: boolean,
  encoder?: Encoder<any> | null,
  results?: Array<string> | null
}

export type HashFunction<T> = (payload: T) => T

export type Hashes<T> = {
  sha512Hmac: HashFunction<T>,
  sha256: HashFunction<T>,
  sha512: HashFunction<T>,
  ripemd160: HashFunction<T>,
  hash256: HashFunction<T>,
  hash160: HashFunction<T>,
  hmac: (HashFunction<T>, key: T) => any,
  formatEncoder?: Encoder<T>
}

export type Secp256k1<T> = {
  privateKeyTweakAdd: (privateKey: T, tweak: T) => Promise<Buffer>,

  publicKeyCreate: (privateKey: T, compressed?: boolean) => Promise<Buffer>,

  publicKeyVerify?: (publicKey: T) => Promise<boolean>,

  publicKeyTweakAdd: (
    publicKey: T,
    tweak: T,
    compressed?: boolean
  ) => Promise<Buffer>,

  signatureNormalize: (signature: T) => T,

  signatureExport: (signature: T) => T,

  toDER: (signature: T) => string,

  sign: (
    message: T,
    privateKey: T
  ) => Promise<{ signature: Buffer, recovery: number }>,

  verify: (message: T, signature: T, publicKey: T) => Promise<boolean>,

  formatEncoder?: Encoder<T>
}

export type SaveFunc = (obj: Object) => void | Promise<void>
export type LoadFunc = () => Object | Promise<Object>
export type PersistStatus = {
  loaded?: boolean,
  changed?: boolean,
  saving?: TimeoutID | null
}

export type QueryParams = {
  path: string,
  value?: any,
  limit?: number
}

export type RecQueryParams = {
  path: Array<string>,
  results: Array<any>,
  value?: any,
  limit?: number
}
