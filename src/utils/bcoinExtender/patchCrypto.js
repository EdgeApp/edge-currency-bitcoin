import { Buffer } from "buffer";

import bcoin from "bcoin";
import { nfkd } from "unorm";

import { Utils } from "../nidavellir";

const patched = {};

const patchSecp256k1 = function(secp256k1) {
  if (!patched["secp256k1"] && secp256k1) {
    // $FlowFixMe
    Utils.Secp256k1.secp256k1(secp256k1);
    patched["secp256k1"] = true;
  }
};

const patchPbkdf2 = function(pbkdf2) {
  if (!patched["pbkdf2"] && pbkdf2) {
    const mnemonic = bcoin.hd.Mnemonic.prototype;

    mnemonic.toSeed = async function(passphrase) {
      if (!passphrase) passphrase = this.passphrase;
      this.passphrase = passphrase;

      const phrase = nfkd(this.getPhrase());
      const passwd = nfkd("mnemonic" + passphrase);
      const res = await pbkdf2.deriveAsync(
        Buffer.from(phrase, "utf8"),
        Buffer.from(passwd, "utf8"),
        2048,
        64,
        "sha512"
      );
      return Buffer.from(res).toString("hex");
    };

    patched["pbkdf2"] = true;
  }
};

export const patchCrypto = (secp256k1, pbkdf2) => {
  patchSecp256k1(secp256k1);
  patchPbkdf2(pbkdf2);
};
