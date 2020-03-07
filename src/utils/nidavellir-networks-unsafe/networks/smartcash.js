// @flow
import bs58sc from 'bs58smartcheck'
import bcoin from 'bcoin'

const base58 = {
  decode: (address: string) => bs58sc.decode(address).toString('hex'),
  encode: (data: Buffer) => bs58sc.encode(Buffer.from(data, 'hex'))
}

const sha256 = (rawTx: string) => {
  const buf = Buffer.from(rawTx, 'hex')
  return bcoin.crypto.digest.sha256(buf)
}

export const main = {
  magic: 0x5ca1ab1e,
  keyPrefix: {
    privkey: 0xbf,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 224
  },
  addressPrefix: {
    pubkeyhash: 0x3f,
    scripthash: 0x12
  },
  serializers: {
    address: base58,
    wif: base58,
    txHash: (rawTx) => sha256(rawTx).toString('hex'),
    signatureHash: sha256
  }
}
