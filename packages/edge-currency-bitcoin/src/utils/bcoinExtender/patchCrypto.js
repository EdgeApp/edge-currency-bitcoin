import { Buffer } from 'buffer'
// import { Utils } from 'nidavellir'
import { nfkd } from 'unorm'
import { Utils } from 'nidavellir'
import bcoin from 'bcoin'

const patched = {}

const patchSecp256k1 = function (secp256k1) {
  if (!patched['secp256k1'] && secp256k1) {
    // $FlowFixMe
    Utils.Secp256k1.secp256k1(secp256k1)
    patched['secp256k1'] = true
  }
}

const patchPbkdf2 = function (pbkdf2) {
  if (!patched['pbkdf2'] && pbkdf2) {
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
    patched['pbkdf2'] = true
  }
}

export const patchCrypto = (secp256k1, pbkdf2) => {
  patchSecp256k1(secp256k1)
  patchPbkdf2(pbkdf2)
}
