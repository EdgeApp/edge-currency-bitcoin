export const patchTransaction = function (bcoin) {
  const txProto = bcoin.primitives.TX.prototype
  const signature = txProto.signature

  // Patch `signature` to recive `hashType` as either a number or a Fork Object
  // The fork object can have the following props (all are optional):
  // {
  //   SIGHASH_FORKID = 0x00,
  //   forcedMinVersion = 0,
  //   forkId = 0x00,
  //   type = null
  // }
  txProto.signature = function (index, prev, value, key, type, version) {
    if (typeof type === 'object') {
      const {
        SIGHASH_FORKID = 0x00,
        forcedMinVersion = 0,
        forkId = 0x00,
        type: forkedType = bcoin.script.hashType.ALL
      } = type
      type = forkedType | SIGHASH_FORKID | forkId * 256
      if (forcedMinVersion) version = forcedMinVersion
    }

    return signature.call(this, index, prev, value, key, type, version)
  }
}
