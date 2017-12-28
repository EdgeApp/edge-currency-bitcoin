import assert from 'assert'

export const patchDerivePublic = function (bcoin, secp256k1) {
  const publicKey = bcoin.hd.PublicKey.prototype
  publicKey.derive = async function (index, hardened) {
    assert(typeof index === 'number')

    if ((index >>> 0) !== index) {
      throw new Error('Index out of range.')
    }

    if ((index & bcoin.hd.common.HARDENED) || hardened) {
      throw new Error('Cannot derive hardened.')
    }

    if (this.depth >= 0xff) {
      throw new Error('Depth too high.')
    }

    const id = this.getID(index)
    const cache = bcoin.hd.common.cache.get(id)

    if (cache) return cache

    const bw = bcoin.utils.StaticWriter.pool(37)

    bw.writeBytes(this.publicKey)
    bw.writeU32BE(index)

    const data = bw.render()

    const hash = bcoin.crypto.digest.hmac('sha512', data, this.chainCode)
    const left = hash.slice(0, 32)
    const right = hash.slice(32, 64)

    let key
    try {
      const result = secp256k1.publicKeyTweakAdd(this.publicKey, left, true)
      if (typeof result.then === 'function') {
        key = await Promise.resolve(result)
        key = Buffer.from(key)
      } else {
        key = result
      }
    } catch (e) {
      return this.derive(index + 1)
    }

    if (this.fingerPrint === -1) {
      const fp = bcoin.crypto.digest.hash160(this.publicKey)
      this.fingerPrint = fp.readUInt32BE(0, true)
    }

    const child = new bcoin.hd.PublicKey()
    child.network = this.network
    child.depth = this.depth + 1
    child.parentFingerPrint = this.fingerPrint
    child.childIndex = index
    child.chainCode = right
    child.publicKey = key

    bcoin.hd.common.cache.set(id, child)

    return child
  }
}

export const patchDerivePrivate = function (bcoin, secp256k1) {
  const privateKey = bcoin.hd.PrivateKey.prototype
  privateKey.derive = async function (index, hardened) {
    assert(typeof index === 'number')

    if ((index >>> 0) !== index) {
      throw new Error('Index out of range.')
    }

    if (this.depth >= 0xff) {
      throw new Error('Depth too high.')
    }

    if (hardened) {
      index |= bcoin.hd.common.HARDENED
      index >>>= 0
    }

    const id = this.getID(index)
    const cache = bcoin.hd.common.cache.get(id)

    if (cache) return cache

    const bw = bcoin.utils.StaticWriter.pool(37)

    if (index & bcoin.hd.common.HARDENED) {
      bw.writeU8(0)
      bw.writeBytes(this.privateKey)
      bw.writeU32BE(index)
    } else {
      bw.writeBytes(this.publicKey)
      bw.writeU32BE(index)
    }

    const data = bw.render()

    const hash = bcoin.crypto.digest.hmac('sha512', data, this.chainCode)
    const left = hash.slice(0, 32)
    const right = hash.slice(32, 64)

    let key
    try {
      const result = secp256k1.privateKeyTweakAdd(this.privateKey, left)
      if (typeof result.then === 'function') {
        key = await Promise.resolve(result)
        key = Buffer.from(key)
      } else {
        key = result
      }
    } catch (e) {
      return this.derive(index + 1)
    }

    if (this.fingerPrint === -1) {
      const fp = bcoin.crypto.digest.hash160(this.publicKey)
      this.fingerPrint = fp.readUInt32BE(0, true)
    }

    const child = new bcoin.hd.PrivateKey()
    child.network = this.network
    child.depth = this.depth + 1
    child.parentFingerPrint = this.fingerPrint
    child.childIndex = index
    child.chainCode = right
    child.privateKey = key
    const result = secp256k1.publicKeyCreate(key, true)
    if (typeof result.then === 'function') {
      child.publicKey = await Promise.resolve(result)
      child.publicKey = Buffer.from(child.publicKey)
    } else {
      child.publicKey = result
    }

    bcoin.hd.common.cache.set(id, child)

    return child
  }
}

export const patchDerivePath = function (bcoin) {
  const privateKey = bcoin.hd.PrivateKey.prototype
  privateKey.derivePath = async function (path) {
    const indexes = bcoin.hd.common.parsePath(path, true)

    let key = this

    for (const index of indexes) {
      const result = key.derive(index)
      if (typeof result.then === 'function') {
        key = await Promise.resolve(result)
      } else {
        key = result
      }
    }

    return key
  }
}

export const patchPrivateFromMnemonic = function (bcoin, pbkdf2) {
  const privateKey = bcoin.hd.PrivateKey.prototype
  privateKey.fromMnemonic = async function (mnemonic, network) {
    const passphrase = mnemonic.passphrase
    const phrase = (mnemonic.getPhrase()).normalize('NFKD')
    const passwd = ('mnemonic' + passphrase).normalize('NFKD')

    let derived = await pbkdf2.deriveAsync(
      Buffer.from(phrase, 'utf8'),
      Buffer.from(passwd, 'utf8'),
      2048, 64, 'sha512')
    derived = Buffer.from(derived)
    return this.fromSeed(derived, network)
  }
}
