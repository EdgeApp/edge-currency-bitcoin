// @flow
import bcoin from 'bcoin'
import bs58grscheck from 'bs58grscheck'

const isBech32 = address => {
  try {
    const hrp = bcoin.utils.bech32.decode(address).hrp
    return hrp === 'grs'
  } catch (e) {
    return false
  }
}

const base58 = {
  decode: (address: string) => {
    if (isBech32(address)) return address
    return bs58grscheck.decode(address).toString('hex')
  },
  encode: (data: Buffer) => {
    if (isBech32(data)) return data
    const payload = Buffer.from(data, 'hex')
    return bs58grscheck.encode(payload)
  }
}

const sha256 = (rawTx: string) => {
  const buf = Buffer.from(rawTx, 'hex')
  return bcoin.crypto.digest.sha256(buf)
}

export const main = {
  magic: 0xf9beb4d4,
  supportedBips: [84, 49],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 17
  },
  addressPrefix: {
    pubkeyhash: 0x24,
    scripthash: 0x05,
    bech32: 'grs'
  },
  serializers: {
    address: base58,
    wif: base58,
    txHash: (rawTx) => sha256(rawTx).toString('hex'),
    signatureHash: sha256
  }
}
