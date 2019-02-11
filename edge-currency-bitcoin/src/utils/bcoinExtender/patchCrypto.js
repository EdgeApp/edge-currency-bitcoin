import { Buffer } from 'buffer'
import { Crypto } from 'perian'
import { nfkd } from 'unorm'

export const patchSecp256k1 = function (bcoin, secp256k1) {
  const privateKey = bcoin.hd.PrivateKey.prototype
  try {
    Crypto.secp256k1.injectModule(secp256k1)
    // bcoin.crypto.secp256k1.toHexString = a => a.toString('hex')
    // bcoin.crypto.secp256k1.fromHesString = a => Buffer.from(a, 'hex')
  } catch (e) {
    console.log(e)
  }

  privateKey.toPublic = async function () {
    let key = this._hdPublicKey

    if (!key) {
      key = new bcoin.hd.PublicKey()
      key.network = this.network
      key.depth = this.depth
      key.parentFingerPrint = this.parentFingerPrint
      key.childIndex = this.childIndex
      key.chainCode = this.chainCode
      if (!this.publicKey) {
        const result = secp256k1.publicKeyCreate(this.privateKey, true)
        if (typeof result.then === 'function') {
          this.publicKey = await Promise.resolve(result)
          this.publicKey = Buffer.from(this.publicKey)
        } else {
          this.publicKey = result
        }
      }

      key.publicKey = this.publicKey
      this._hdPublicKey = key
    }

    return key
  }

  privateKey.xpubkey = async function () {
    const pubKey = await this.toPublic()
    return pubKey.xpubkey()
  }
}

export const patchPbkdf2 = function (bcoin, pbkdf2) {
  const privateKey = bcoin.hd.PrivateKey.prototype
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
