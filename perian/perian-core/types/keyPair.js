// @flow
export type PublicKey<T> = { publicKey: T }
export type PrivateKey<T> = { privateKey: T, publicKey?: T }
export type KeyPair<T> = { privateKey?: T, publicKey?: T }
export type MasterKeyPair<T> = { privateKey: T, publicKey: T }
