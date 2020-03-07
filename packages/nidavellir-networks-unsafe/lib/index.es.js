import bcoin from 'bcoin';
import bs58grscheck from 'bs58grscheck';
import bs58sc from 'bs58smartcheck';

const toVarByteString = hex => {
  const len = hex.length / 2;
  const str = len.toString(16);
  const hexLen = str.length % 2 === 0 ? str : `0${str}`;
  return hexLen + hex;
};

const scriptProto = bcoin.script.prototype;
const getPubkey = scriptProto.getPubkey;

scriptProto.getPubkey = function (minimal) {
  if (this.code.length === 6) {
    const size = this.getLength(4);

    if ((size === 33 || size === 65) && this.getOp(5) === parseInt(OP_CHECKSIG, 16)) {
      return this.getData(4);
    }
  }

  return getPubkey.call(this, minimal);
};

const OP_CHECKDATASIGVERIFY = 'bb';
const OP_CHECKDATASIG = 'ba';
const OP_CHECKSIG = 'ac';
const SIGNATURE = '30440220256c12175e809381f97637933ed6ab97737d263eaaebca6add21bced67fd12a402205ce29ecc1369d6fc1b51977ed38faaf41119e3be1d7edfafd7cfaf0b6061bd07';
const MESSAGE = '';
const PUBKEY = '038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508';

const cds = (sig, msg, pubKey, hdKey) => {
  const cdsSuffix = `${toVarByteString(hdKey ? hdKey.publicKey.toString('hex') : '')}${OP_CHECKSIG}`;
  const cdsPrefix = `0x${toVarByteString(sig)}${toVarByteString(msg)}${toVarByteString(pubKey)}`;
  return [cdsPrefix, cdsSuffix];
};

const main = {
  forks: ['bitcoincashsv'],
  keyPrefix: {
    coinType: 145
  },
  addressPrefix: {
    cashAddress: 'bitcoincash'
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
    replayProtection: hdKey => cds(SIGNATURE, MESSAGE, PUBKEY, hdKey).join(OP_CHECKDATASIGVERIFY),
    checkdatasig: hdKey => (sig = '', msg = '', pubKey = '') => cds(sig, msg, pubKey, hdKey).join(OP_CHECKDATASIG),
    checkdatasigverify: hdKey => (sig = '', msg = '', pubKey = '') => cds(sig, msg, pubKey, hdKey).join(OP_CHECKDATASIGVERIFY)
  }
};

var bitcoincash = /*#__PURE__*/Object.freeze({
  main: main
});

const isBech32 = address => {
  try {
    const hrp = bcoin.utils.bech32.decode(address).hrp;
    return hrp === 'grs';
  } catch (e) {
    return false;
  }
};

const base58 = {
  decode: address => {
    if (isBech32(address)) return address;
    return bs58grscheck.decode(address).toString('hex');
  },
  encode: data => {
    if (isBech32(data)) return data;
    const payload = Buffer.from(data, 'hex');
    return bs58grscheck.encode(payload);
  }
};

const sha256 = rawTx => {
  const buf = Buffer.from(rawTx, 'hex');
  return bcoin.crypto.digest.sha256(buf);
};

const main$1 = {
  magic: 0xf9beb4d4,
  bips: [84, 49],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 17
  },
  addressPrefix: {
    pubkeyhash: 0x24,
    scripthash: 0x05,
    bech32: 'grs'
  },
  serializers: {
    address: base58,
    wif: base58,
    txHash: rawTx => sha256(rawTx).toString('hex'),
    signatureHash: sha256
  }
};

var groestlcoin = /*#__PURE__*/Object.freeze({
  main: main$1
});

const base58$1 = {
  decode: address => bs58sc.decode(address).toString('hex'),
  encode: data => bs58sc.encode(Buffer.from(data, 'hex'))
};

const sha256$1 = rawTx => {
  const buf = Buffer.from(rawTx, 'hex');
  return bcoin.crypto.digest.sha256(buf);
};

const main$2 = {
  magic: 0x5ca1ab1e,
  keyPrefix: {
    privkey: 0xbf,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 224
  },
  addressPrefix: {
    pubkeyhash: 0x3f,
    scripthash: 0x12
  },
  serializers: {
    address: base58$1,
    wif: base58$1,
    txHash: rawTx => sha256$1(rawTx).toString('hex'),
    signatureHash: sha256$1
  }
};

var smartcash = /*#__PURE__*/Object.freeze({
  main: main$2
});

export { groestlcoin, bitcoincash, smartcash };
//# sourceMappingURL=index.es.js.map
