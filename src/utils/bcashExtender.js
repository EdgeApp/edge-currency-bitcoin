export const patchBcashTX = bcoin => {
  const txProto = bcoin.primitives.TX.prototype
  const signature = txProto.signature
  txProto.signature = function (index, prev, value, key, type, version) {
    if (type === -100) {
      // Patch bcoin with bitcoincash compatibility:
      // 1. Flip the FORKID bit in the sighash type
      // 2. Always use segwit's sighash digest algorithm (BIP 143)
      type = 0x01 | 0x40
      version = 1
    }
    return signature.call(this, index, prev, value, key, type, version)
  }
}
