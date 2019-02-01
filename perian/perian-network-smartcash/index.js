// @flow

import bs58sc from 'bs58smartcheck'
import { utils, crypto } from 'bcoin'

const base58 = {
  decode: (address: string) => {
    const payload = bs58sc.decode(address)
    const bw = new utils.StaticWriter(payload.length + 4)
    bw.writeBytes(payload)
    bw.writeChecksum()
    return utils.base58.encode(bw.render())
  },
  encode: (address: string) => {
    const payload = utils.base58.decode(address)
    return bs58sc.encode(payload.slice(0, -4))
  }
}

const sha256 = (rawTx: string) => {
  const buf = Buffer.from(rawTx, 'hex')
  return crypto.digest.sha256(buf)
}

const main = {
  magic: 0x5ca1ab1e,
  supportedBips: [44, 32],
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
    txHash: (rawTx: string) => sha256(rawTx).toString('hex'),
    signatureHash: sha256
  }
}

module.exports = { main }
