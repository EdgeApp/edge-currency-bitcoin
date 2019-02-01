const bcoin = require('bcoin')
const bs58grscheck = require('bs58grscheck')

const isBech32 = address => {
  try {
    const hrp = bcoin.utils.bech32.decode(address).hrp
    return hrp === 'grs'
  } catch (e) {
    return false
  }
}

const base58 = {
  decode: (address) => {
    if (isBech32(address)) return address
    const payload = bs58grscheck.decode(address)
    const bw = new bcoin.utils.StaticWriter(payload.length + 4)
    bw.writeBytes(payload)
    bw.writeChecksum()
    return bcoin.utils.base58.encode(bw.render())
  },
  encode: (address) => {
    if (isBech32(address)) return address
    const payload = bcoin.utils.base58.decode(address)
    return bs58grscheck.encode(payload.slice(0, -4))
  }
}

const sha256 = (rawTx) => {
  const buf = Buffer.from(rawTx, 'hex')
  return bcoin.crypto.digest.sha256(buf)
}

const main = {
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

module.exports = { main }
