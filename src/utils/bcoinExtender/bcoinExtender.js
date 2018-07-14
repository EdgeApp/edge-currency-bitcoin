// @flow
import {
  patchDerivePublic,
  patchDerivePrivate,
  patchDerivePath,
  patchPrivateFromMnemonic
} from './deriveExtender.js'
import { patchTransaction } from './replayProtection.js'
import bcoin from 'bcoin'

export type BcoinCurrencyInfo = {
  type: string,
  magic: number,
  keyPrefix: {
    privkey: number,
    xpubkey: number,
    xprivkey: number,
    xpubkey58: string,
    xprivkey58: string,
    coinType: number
  },
  addressPrefix: {
    pubkeyhash: number,
    scripthash: number,
    cashAddress?: string,
    pubkeyhashLegacy?: number,
    scripthashLegacy?: number,
    witnesspubkeyhash?: number,
    witnessscripthash?: number,
    bech32?: string
  },
  replayProtection?: {
    SIGHASH_FORKID: number,
    forcedMinVersion: number,
    forkId: number
  }
}

let cryptoReplaced = false
patchTransaction(bcoin)

export const addNetwork = (bcoinInfo: BcoinCurrencyInfo) => {
  const type = bcoinInfo.type
  console.warn('bcoinInfo', bcoinInfo)
  if (bcoin.networks.types.indexOf(type) === -1) {
    bcoin.networks.types.push(type)
    bcoin.networks[type] = { ...bcoin.networks.main, ...bcoinInfo }
  }
}

export const patchCrypto = (secp256k1?: any = null, pbkdf2?: any = null) => {
  if (!cryptoReplaced) {
    if (secp256k1) {
      patchDerivePublic(bcoin, secp256k1)
      patchDerivePrivate(bcoin, secp256k1)
      patchDerivePath(bcoin)
      cryptoReplaced = true
    }
    if (pbkdf2) {
      patchPrivateFromMnemonic(bcoin, pbkdf2)
      cryptoReplaced = true
    }
  }
}
