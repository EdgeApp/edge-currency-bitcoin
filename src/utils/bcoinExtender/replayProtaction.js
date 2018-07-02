import assert from 'assert'
// $FlowFixMe
import buffer from 'buffer-hack'
// $FlowFixMe
const { Buffer } = buffer

export const patchTransaction = function (bcoin) {
  const txProto = bcoin.primitives.TX.prototype
  const defaultHashType = bcoin.script.hashType

  // Patch `signature` to recive `hashType` as either a number or a Fork Object
  // The fork object can have the following props (all are optional):
  // {
  //   SIGHASH_FORKID = 0x00,
  //   forcedMinVersion = 0,
  //   forkId = 0x00,
  //   type = null
  // }
  txProto.signature = function (index, prev, value, key, hashType, version) {
    const {
      SIGHASH_FORKID = 0x00,
      forcedMinVersion = 0,
      forkId = 0x00,
      type = typeof hashType === 'number' ? hashType : null
    } =
      typeof hashType === 'object' ? hashType : {}

    const forkedHashType = Object.keys(defaultHashType).reduce(
      (result, type) => ({
        ...result,
        [type]: defaultHashType[type] | SIGHASH_FORKID | forkId
      }),
      {}
    )

    const forkedType =
      type != null ? type | SIGHASH_FORKID | forkId : forkedHashType.ALL

    if (forcedMinVersion) version = forcedMinVersion
    if (version == null) version = 0

    const hash = this.signatureHash(
      index,
      prev,
      value,
      forkedType,
      version,
      forkedHashType
    )
    const sig = bcoin.crypto.secp256k1.sign(hash, key)
    const bw = new bcoin.utils.StaticWriter(sig.length + 1)

    bw.writeBytes(sig)
    bw.writeU8(forkedType)

    return bw.render()
  }

  // Patch signatureHash
  // Allows for the passing of `hashType`
  txProto.signatureHash = function (
    index,
    prev,
    value,
    type,
    version,
    hashType = defaultHashType
  ) {
    assert(index >= 0 && index < this.inputs.length)
    assert(prev instanceof bcoin.script)
    assert(typeof value === 'number')
    assert(typeof type === 'number')

    // Traditional sighashing
    if (version === 0) return this.signatureHashV0(index, prev, type, hashType)

    // Segwit sighashing
    if (version === 1) {
      return this.signatureHashV1(index, prev, value, type, hashType)
    }

    throw new Error('Unknown sighash version.')
  }

  // Patch signatureHashV0
  // Allows for the passing of `hashType`
  txProto.signatureHashV0 = function (
    index,
    prev,
    type,
    hashType = defaultHashType
  ) {
    if ((type & 0x1f) === hashType.SINGLE) {
      // Bitcoind used to return 1 as an error code:
      // it ended up being treated like a hash.
      if (index >= this.outputs.length) {
        return Buffer.from(bcoin.utils.encoding.ONE_HASH)
      }
    }

    // Remove all code separators.
    prev = prev.removeSeparators()
    // Calculate buffer size.
    const size = this.hashSize(index, prev, type)
    const bw = bcoin.utils.StaticWriter.pool(size)
    bw.writeU32(this.version)
    // Serialize inputs.
    if (type & hashType.ANYONECANPAY) {
      // Serialize only the current
      // input if ANYONECANPAY.
      const input = this.inputs[index]
      // Count.
      bw.writeVarint(1)
      // Outpoint.
      input.prevout.toWriter(bw)
      // Replace script with previous
      // output script if current index.
      bw.writeVarBytes(prev.toRaw())
      bw.writeU32(input.sequence)
    } else {
      bw.writeVarint(this.inputs.length)
      for (let i = 0; i < this.inputs.length; i++) {
        const input = this.inputs[i]
        // Outpoint.
        input.prevout.toWriter(bw)
        // Replace script with previous
        // output script if current index.
        if (i === index) {
          bw.writeVarBytes(prev.toRaw())
          bw.writeU32(input.sequence)
          continue
        }
        // Script is null.
        bw.writeVarint(0)
        // Sequences are 0 if NONE or SINGLE.
        switch (type & 0x1f) {
          case hashType.NONE:
          case hashType.SINGLE:
            bw.writeU32(0)
            break
          default:
            bw.writeU32(input.sequence)
            break
        }
      }
    }
    // Serialize outputs.
    switch (type & 0x1f) {
      case hashType.NONE: {
        // No outputs if NONE.
        bw.writeVarint(0)
        break
      }
      case hashType.SINGLE: {
        const output = this.outputs[index]
        // Drop all outputs after the
        // current input index if SINGLE.
        bw.writeVarint(index + 1)
        for (let i = 0; i < index; i++) {
          // Null all outputs not at
          // current input index.
          bw.writeI64(-1)
          bw.writeVarint(0)
        }
        // Regular serialization
        // at current input index.
        output.toWriter(bw)
        break
      }
      default: {
        // Regular output serialization if ALL.
        bw.writeVarint(this.outputs.length)
        for (const output of this.outputs) output.toWriter(bw)
        break
      }
    }
    bw.writeU32(this.locktime)
    // Append the hash type.
    bw.writeU32(type)
    return bcoin.crypto.digest.hash256(bw.render())
  }
  // Patch signatureHashV1
  // Allows for the passing of `hashType`
  txProto.signatureHashV1 = function (
    index,
    prev,
    value,
    type,
    hashType = defaultHashType
  ) {
    const input = this.inputs[index]
    let prevouts = bcoin.utils.encoding.ZERO_HASH
    let sequences = bcoin.utils.encoding.ZERO_HASH
    let outputs = bcoin.utils.encoding.ZERO_HASH

    if (!(type & hashType.ANYONECANPAY)) {
      if (this._hashPrevouts) {
        prevouts = this._hashPrevouts
      } else {
        const bw = bcoin.utils.StaticWriter.pool(this.inputs.length * 36)
        for (const input of this.inputs) input.prevout.toWriter(bw)
        prevouts = bcoin.crypto.digest.hash256(bw.render())
        if (!this.mutable) this._hashPrevouts = prevouts
      }
    }

    if (
      !(type & hashType.ANYONECANPAY) &&
      (type & 0x1f) !== hashType.SINGLE &&
      (type & 0x1f) !== hashType.NONE
    ) {
      if (this._hashSequence) {
        sequences = this._hashSequence
      } else {
        const bw = bcoin.utils.StaticWriter.pool(this.inputs.length * 4)
        for (const input of this.inputs) bw.writeU32(input.sequence)
        sequences = bcoin.crypto.digest.hash256(bw.render())
        if (!this.mutable) this._hashSequence = sequences
      }
    }

    if ((type & 0x1f) !== hashType.SINGLE && (type & 0x1f) !== hashType.NONE) {
      if (this._hashOutputs) {
        outputs = this._hashOutputs
      } else {
        let size = 0
        for (const output of this.outputs) size += output.getSize()
        const bw = bcoin.utils.StaticWriter.pool(size)
        for (const output of this.outputs) output.toWriter(bw)
        outputs = bcoin.crypto.digest.hash256(bw.render())
        if (!this.mutable) this._hashOutputs = outputs
      }
    } else if ((type & 0x1f) === hashType.SINGLE) {
      if (index < this.outputs.length) {
        const output = this.outputs[index]
        outputs = bcoin.crypto.digest.hash256(output.toRaw())
      }
    }

    const size = 156 + prev.getVarSize()
    const bw = bcoin.utils.StaticWriter.pool(size)

    bw.writeU32(this.version)
    bw.writeBytes(prevouts)
    bw.writeBytes(sequences)
    bw.writeHash(input.prevout.hash)
    bw.writeU32(input.prevout.index)
    bw.writeVarBytes(prev.toRaw())
    bw.writeI64(value)
    bw.writeU32(input.sequence)
    bw.writeBytes(outputs)
    bw.writeU32(this.locktime)
    bw.writeU32(type)

    return bcoin.crypto.digest.hash256(bw.render())
  }
}
