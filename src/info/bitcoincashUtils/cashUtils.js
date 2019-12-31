// @flow

import { primitives, script } from 'bcoin'

import { cashAddressToHash, toCashAddress } from './cashAddress'

const scriptProto = script.prototype
const getPubkey = scriptProto.getPubkey
scriptProto.getPubkey = function(minimal: boolean) {
  if (this.code.length === 6) {
    const size = this.getLength(4)

    if (
      (size === 33 || size === 65) &&
      this.getOp(5) === parseInt(OP_CHECKSIG, 16)
    ) {
      return this.getData(4)
    }
  }

  return getPubkey.call(this, minimal)
}
const OP_CHECKDATASIGVERIFY = 'bb'
const OP_CHECKDATASIG = 'ba'
const OP_CHECKSIG = 'ac'
const SIGNATURE =
  '30440220256c12175e809381f97637933ed6ab97737d263eaaebca6add21bced67fd12a402205ce29ecc1369d6fc1b51977ed38faaf41119e3be1d7edfafd7cfaf0b6061bd07'
const MESSAGE = ''
const PUBKEY =
  '038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508'
const hexToVarByte = (hex: string) => {
  const len = hex.length / 2
  const str = len.toString(16)
  const hexLen = str.length % 2 === 0 ? str : `0${str}`
  return hexLen + hex
}
const cds = (sig: string, msg: string, pubKey: string, hdKey: any) => {
  const cdsSuffix = `${hexToVarByte(
    hdKey ? hdKey.publicKey.toString('hex') : ''
  )}${OP_CHECKSIG}`
  const cdsPrefix = `0x${hexToVarByte(sig)}${hexToVarByte(msg)}${hexToVarByte(
    pubKey
  )}`
  return [cdsPrefix, cdsSuffix]
}

export const scriptTemplates = {
  replayProtection: (hdKey: any) =>
    cds(SIGNATURE, MESSAGE, PUBKEY, hdKey).join(OP_CHECKDATASIGVERIFY),
  checkdatasig: (hdKey: any) => (
    sig: string = '',
    msg: string = '',
    pubKey: string = ''
  ) => cds(sig, msg, pubKey, hdKey).join(OP_CHECKDATASIG),
  checkdatasigverify: (hdKey: any) => (
    sig: string = '',
    msg: string = '',
    pubKey: string = ''
  ) => cds(sig, msg, pubKey, hdKey).join(OP_CHECKDATASIGVERIFY)
}

const decode = (network: string) => (address: string) => {
  address = `${network}:${address}`
  const addressInfo = cashAddressToHash(address)
  const { hashBuffer, type } = addressInfo
  return primitives.Address.fromHash(hashBuffer, type, -1, network).toBase58()
}

const encode = (network: string) => (address: string) => {
  try {
    address = decode(network)(address)
  } catch (e) {}
  const splitAddress = address.split(':')
  address = splitAddress[1] || splitAddress[0]
  const addressObj = primitives.Address.fromBase58(address)
  const type = addressObj.getType()
  const newAddress = toCashAddress(addressObj.hash, type, network)
  return newAddress.split(':')[1]
}

export const cashAddress = (network: string) => {
  return {
    decode: decode(network),
    encode: encode(network)
  }
}
