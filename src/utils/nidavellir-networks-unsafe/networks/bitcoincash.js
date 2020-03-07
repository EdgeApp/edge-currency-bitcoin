import bcoin from "bcoin";

const toVarByteString = hex => {
  const len = hex.length / 2;
  const str = len.toString(16);
  const hexLen = str.length % 2 === 0 ? str : `0${str}`;
  return hexLen + hex;
};

const scriptProto = bcoin.script.prototype;
const getPubkey = scriptProto.getPubkey;
scriptProto.getPubkey = function(minimal) {
  if (this.code.length === 6) {
    const size = this.getLength(4);

    if (
      (size === 33 || size === 65) &&
      this.getOp(5) === parseInt(OP_CHECKSIG, 16)
    ) {
      return this.getData(4);
    }
  }

  return getPubkey.call(this, minimal);
};

const OP_CHECKDATASIGVERIFY = "bb";
const OP_CHECKDATASIG = "ba";
const OP_CHECKSIG = "ac";
const SIGNATURE =
  "30440220256c12175e809381f97637933ed6ab97737d263eaaebca6add21bced67fd12a402205ce29ecc1369d6fc1b51977ed38faaf41119e3be1d7edfafd7cfaf0b6061bd07";
const MESSAGE = "";
const PUBKEY =
  "038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508";
const cds = (sig, msg, pubKey, hdKey) => {
  const cdsSuffix = `${toVarByteString(
    hdKey ? hdKey.publicKey.toString("hex") : ""
  )}${OP_CHECKSIG}`;
  const cdsPrefix = `0x${toVarByteString(sig)}${toVarByteString(
    msg
  )}${toVarByteString(pubKey)}`;
  return [cdsPrefix, cdsSuffix];
};

export const main = {
  forks: ["bitcoincashsv"],
  keyPrefix: {
    coinType: 145
  },
  addressPrefix: {
    cashAddress: "bitcoincash"
  },
  legacyAddressPrefix: {
    pubkeyhash: 0x00,
    scripthash: 0x05
  },
  replayProtection: {
    forkSighash: 0x40,
    forcedMinVersion: 1
  },
  scriptTemplates: {
    replayProtection: hdKey =>
      cds(SIGNATURE, MESSAGE, PUBKEY, hdKey).join(OP_CHECKDATASIGVERIFY),
    checkdatasig: hdKey => (sig = "", msg = "", pubKey = "") =>
      cds(sig, msg, pubKey, hdKey).join(OP_CHECKDATASIG),
    checkdatasigverify: hdKey => (sig = "", msg = "", pubKey = "") =>
      cds(sig, msg, pubKey, hdKey).join(OP_CHECKDATASIGVERIFY)
  }
};
