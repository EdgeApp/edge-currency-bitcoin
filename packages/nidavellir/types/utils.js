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
  // If null then don't hex the result.
  // If empty array, hex the result.
  // If not empty array, assume the result is an object and hex the values for the array keys
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
