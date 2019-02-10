const sha3 = require('js-sha3').keccak256
const { Crypto, Base } = require('@perian/core-utils')

const { createHexEncoder, base } = Base
const sha3Hash = Crypto.digest(() => sha3)
const bs58sc = createHexEncoder(base['58'], sha3Hash).check

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
    address: bs58sc,
    wif: bs58sc,
    txHash: Crypto.sha256,
    sigHash: str => Buffer.from(Crypto.sha256(str.toString('hex')), 'hex')
  }
}

module.exports = { main }
