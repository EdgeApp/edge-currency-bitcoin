import assert from 'assert'
import { nfkd } from 'unorm'
// $FlowFixMe
import buffer from 'buffer-hack'
// $FlowFixMe
const { Buffer } = buffer

const SEED_SALT = Buffer.from('Bitcoin seed', 'ascii')

export const secp256k1Patch = function (bcoin, secp256k1) {
  const publicKey = bcoin.hd.PublicKey.prototype
  const privateKey = bcoin.hd.PrivateKey.prototype
  const keyRing = bcoin.primitives.KeyRing.prototype

  // Patch From Private to use async version of secp256k1
  keyRing.fromPrivate = async function (key, compress, network) {
    assert(Buffer.isBuffer(key), 'Private key must be a buffer.')
    const validKey = await secp256k1.privateKeyVerify(key)
    assert(validKey, 'Not a valid private key.')
    if (typeof compress !== 'boolean') {
      network = compress
      compress = null
    }
    this.network = bcoin.network.get(network)
    this.privateKey = key
    this.publicKey = await secp256k1.publicKeyCreate(key, compress !== false)
    return this
  }

  keyRing.fromPublic = async function (key, network) {
    assert(Buffer.isBuffer(key), 'Public key must be a buffer.')
    const validKey = await secp256k1.publicKeyVerify(key)
    assert(validKey, 'Not a valid public key.')
    this.network = bcoin.network.get(network)
    this.publicKey = key
    return this
  }

  // Patch Derive to use async version of secp256k1
  privateKey.derive = async function (index, hardened) {
    assert(typeof index === 'number')

    if (index >>> 0 !== index) {
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
      key = await secp256k1.privateKeyTweakAdd(this.privateKey, left)
      key = Buffer.from(key)
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
    const publicKey = await secp256k1.publicKeyCreate(key, true)
    child.publicKey = Buffer.from(publicKey)
    bcoin.hd.common.cache.set(id, child)

    return child
  }

  // Patch Derive Path to use async version of derive
  privateKey.derivePath = async function (path) {
    const indexes = bcoin.hd.common.parsePath(path, true)

    let key = this

    for (const index of indexes) {
      key = await key.derive(index)
    }

    return key
  }

  // Patch From Seed to use async version of secp256k1
  privateKey.fromSeed = async function (seed, network) {
    assert(Buffer.isBuffer(seed))

    if (
      (seed.length * 8 < bcoin.hd.common.MIN_ENTROPY) ||
      (seed.length * 8 > bcoin.hd.common.MAX_ENTROPY)) {
      throw new Error('Entropy not in range.')
    }

    const hash = bcoin.crypto.digest.hmac('sha512', seed, SEED_SALT)
    const left = hash.slice(0, 32)
    const right = hash.slice(32, 64)

    // Only a 1 in 2^127 chance of happening.
    const privateKeyVerify = await secp256k1.privateKeyVerify(left)
    if (!privateKeyVerify) throw new Error('Master private key is invalid.')

    this.network = bcoin.network.get(network)
    this.depth = 0
    this.parentFingerPrint = 0
    this.childIndex = 0
    this.chainCode = right
    this.privateKey = left
    this.publicKey = await secp256k1.publicKeyCreate(left, true)

    return this
  }

  // Patch Derive to use async version of secp256k1
  publicKey.derive = async function (index, hardened) {
    assert(typeof index === 'number')

    if (index >>> 0 !== index) {
      throw new Error('Index out of range.')
    }

    if (index & bcoin.hd.common.HARDENED || hardened) {
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
      key = await secp256k1.publicKeyTweakAdd(this.publicKey, left, true)
      key = Buffer.from(key)
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

export const pbkdf2Patch = function (bcoin, pbkdf2) {
  const privateKey = bcoin.hd.PrivateKey.prototype

  // Patch From Mnemonic to use async version of pbkdf2
  privateKey.fromMnemonic = async function (mnemonic, network) {
    const passphrase = mnemonic.passphrase

    const phrase = nfkd(mnemonic.getPhrase())
    const passwd = nfkd('mnemonic' + passphrase)

    let derived = await pbkdf2.deriveAsync(
      Buffer.from(phrase, 'utf8'),
      Buffer.from(passwd, 'utf8'),
      2048,
      64,
      'sha512'
    )
    derived = Buffer.from(derived)
    return this.fromSeed(derived, network)
  }
}
