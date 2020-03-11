// @flow
import { type ExtendedPublicKey, type HDPath } from './hd.js'

export type FromWIF =(wif: string, network?: string) => {
  privateKey: string,
  compress: boolean
}
export type ToWIF =(privateKey: string, network?: string, compress?: boolean) => string
export type ToPublic =(privateKey: string, compress?: boolean) => Promise<string>
export type ToSignature = (privateKey: string, msg: string) => Promise<string>

export type FromSeed<T> = (seed: string, network?: string, version?: string) => T
export type FromHex<T> = (keyHex: string, network?: string) => T
export type FromString<T> = (xKey: string, network?: string) => T
export type FromXKey<T> = (key: $Shape<T>, network?: string) => T
export type ToIndex<T> = (key: T, index: number, hardended?: boolean) => Promise<T>
export type ToPath<T> = (key: T, path: HDPath | string) => Promise<T>
export type ToString<T> = (key: T, network?: string) => string
export type ToXPub<T> = (key: T, network?: string) => Promise<ExtendedPublicKey>
export type ToHex<T> = (key: T) => string
