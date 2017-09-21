const SIGHASH_FORKID = 0x40
const SIGHASH_ALL = 0x01
const SEGWIT_VER = 1

// Patch bcoin with bitcoincash compatibility:
// 1. Flip the FORKID bit in the sighash type
// 2. Always use segwit's sighash digest algorithm (BIP 143)
const bitcoinCashPatch = (bcoin, proto = bcoin.primitives.TX.prototype, fn = proto.signature) =>
  (proto.signature = function (index, prev, value, key, type = SIGHASH_ALL, version) {
    return fn.call(this, index, prev, value, key, type | SIGHASH_FORKID, SEGWIT_VER)
  }) && bcoin

export default (txLibInfo) => {
  const currencyName = txLibInfo.getInfo.currencyName.toLowerCase()
  let bcoin
  if (currencyName === 'bitcoin') {
    bcoin = require('bcoin')
  } else if (currencyName === 'bitcoincash') {
    bcoin = bitcoinCashPatch(require('bcoin'))
  } else {
    bcoin = require('lcoin')
  }
  if (txLibInfo &&
    txLibInfo.getInfo &&
    txLibInfo.getInfo.defaultsSettings &&
    txLibInfo.getInfo.defaultsSettings.networkSettings) {
    const networkSettings = txLibInfo.getInfo.defaultsSettings.networkSettings
    const mainBcoinSettings = bcoin.protocol.networks.main
    const testBcoinSettings = bcoin.protocol.networks.testnet
    if (networkSettings.main) {
      if (typeof networkSettings.main.magic === 'number') {
        mainBcoinSettings.magic = networkSettings.main.magic
      }
      if (networkSettings.main.keyPrefix) {
        mainBcoinSettings.keyPrefix = networkSettings.main.keyPrefix
      }
      if (networkSettings.main.addressPrefix) {
        mainBcoinSettings.addressPrefix = networkSettings.main.addressPrefix
      }
    }
    if (networkSettings.testnet) {
      if (typeof networkSettings.testnet.magic === 'number') {
        testBcoinSettings.magic = networkSettings.testnet.magic
      }
      if (networkSettings.testnet.keyPrefix) {
        testBcoinSettings.keyPrefix = networkSettings.testnet.keyPrefix
      }
      if (networkSettings.testnet.addressPrefix) {
        testBcoinSettings.addressPrefix = networkSettings.testnet.addressPrefix
      }
    }
  }
  return bcoin
}
