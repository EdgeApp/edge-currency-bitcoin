// @flow

export type HDPath = Array<number>

export type ExtendedData = $ReadOnly<{|
  version: number,
  depth: number,
  parentFingerPrint: number,
  chainCode: string,
  childNumber: number
|}>

export type ExtendedPublicKey = $ReadOnly<{|
  ...ExtendedData,
  publicKey: string,
|}>

export type ExtendedPrivateKey = $ReadOnly<{|
  ...ExtendedData,
  privateKey: string,
  publicKey?: string
|}>

export type ExtendedKey = $ReadOnly<ExtendedPrivateKey | ExtendedPublicKey>
