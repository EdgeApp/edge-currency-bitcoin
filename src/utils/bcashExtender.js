import * as bitcoreCash from 'bitcore-lib-cash'
import * as bitcore from 'bitcore-lib'

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

export const toLegacyFormat = bcoin => {
  bcoin.primitives.Address.toLegacyFormat = (address, network) => {
    if (typeof address !== 'string' || !address.includes('bicoincash')) return address
    const origAddress = bitcoreCash.Address(address)
    const origObj = origAddress.toObject()
    const resultAddress = bitcore.Address.fromObject(origObj).toString()
    return resultAddress
  }
}

export const toNewFormat = bcoin => {
  bcoin.primitives.Address.toNewFormat = (address, network) => {
    if (typeof network !== 'string' || !network.includes('bitcoincash')) return address
    if (address.includes('bitcoincash')) return address
    const origAddress = bitcore.Address(address)
    const origObj = origAddress.toObject()
    return bitcoreCash.Address.fromObject(origObj).toCashAddress()
  }
}
