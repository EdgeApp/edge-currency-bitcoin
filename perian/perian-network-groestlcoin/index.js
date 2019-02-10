const { Crypto, Base } = require('@perian/core-utils')
const bcoin = require('bcoin')
const groestl = require('./src/groestl.js')

const groestl2hash = str => {
  str = Buffer.from(str, 'hex')
  let a = groestl(str, 1, 1)
  a = groestl(a, 1, 1)
  a = a.slice(0, 32)
  return Buffer.from(a).toString('hex')
}

const { createHexEncoder, base } = Base
const bs58grscheck = createHexEncoder(base['58'], groestl2hash).check

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
    return bs58grscheck.decode(address).toString('hex')
  },
  encode: (address) => {
    if (isBech32(address)) return address
    return bs58grscheck.encode(Buffer.from(address))
  }
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
    txHash: Crypto.sha256,
    sigHash: buf => Buffer.from(Crypto.sha256(buf.toString('hex')), 'hex')
  }
}

module.exports = { main }
