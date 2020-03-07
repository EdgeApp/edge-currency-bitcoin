'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var buffer = require('buffer');
var basex = _interopDefault(require('base-x'));

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    var ownKeys = Object.keys(source);

    if (typeof Object.getOwnPropertySymbols === 'function') {
      ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) {
        return Object.getOwnPropertyDescriptor(source, sym).enumerable;
      }));
    }

    ownKeys.forEach(function (key) {
      _defineProperty(target, key, source[key]);
    });
  }

  return target;
}

function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;

  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }

  return target;
}

function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};

  var target = _objectWithoutPropertiesLoose(source, excluded);

  var key, i;

  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }

  return target;
}

const lazyHandler = activeModule => ({
  get: (target, prop, receiver) => {
    // If already loaded return the loaded module
    if (activeModule) return activeModule[prop]; // Try to inject the loaded module

    if (prop === 'inject') {
      return loadedModule => {
        activeModule = loadedModule;

        for (const prop in target) {
          target[prop].inject(activeModule[prop]);
        }
      };
    } // Create a new child proxy if this prop not yet exists


    if (!target[prop]) {
      target[prop] = new Proxy(function (...args) {
        if (!activeModule) target();
        return activeModule[prop](...args);
      }, lazyHandler());
    }

    return target[prop];
  }
});

const lazify = unsafeModule => {
  const parentModule = function (injectedModule = {}, loadUnsafe = true) {
    const defaultModule = loadUnsafe ? unsafeModule() : {};
    const loadedModule = Object.assign(defaultModule, injectedModule);
    parentProxy.inject(loadedModule);
  };

  const parentProxy = new Proxy(parentModule, lazyHandler());
  return parentProxy;
};

var Require = /*#__PURE__*/Object.freeze({
  lazify: lazify
});

const isHexString = hex => typeof hex === 'string' && /^[0-9a-f]*$/i.test(hex);
const toUint8Array = hexString => {
  if (!isHexString(hexString)) {
    throw new Error(`${hexString} is Not a Hex string`);
  }

  if (hexString.length % 2 !== 0) hexString = `0${hexString}`;
  const hex = hexString.match(/.{1,2}/g) || [];
  const bytes = hex.map(byte => parseInt(byte, 16));
  return new Uint8Array(bytes);
};
const fromUint8Array = bytes => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

var UintArray = /*#__PURE__*/Object.freeze({
  isHexString: isHexString,
  toUint8Array: toUint8Array,
  fromUint8Array: fromUint8Array
});

const hashjs = lazify(() => require('hash.js'));
const digest = hash => data => {
  const uintArray = toUint8Array(data);
  const rawRes = hash().update(uintArray).digest();
  const resArray = new Uint8Array(rawRes);
  return fromUint8Array(resArray);
};
const digestHmac = (hmac, hash) => (data, key) => {
  const uintKey = toUint8Array(key);

  const hmacHash = () => hmac(hash, uintKey);

  return digest(hmacHash)(data);
};
const sha256 = digest(hashjs.sha256);
const sha512 = digest(hashjs.sha512);
const ripemd160 = digest(hashjs.ripemd160);
const sha512Hmac = digestHmac(hashjs.hmac, hashjs.sha512);
const hash256 = data => sha256(sha256(data));
const hash160 = data => ripemd160(sha256(data));

var Hash = /*#__PURE__*/Object.freeze({
  hashjs: hashjs,
  digest: digest,
  digestHmac: digestHmac,
  sha256: sha256,
  sha512: sha512,
  ripemd160: ripemd160,
  sha512Hmac: sha512Hmac,
  hash256: hash256,
  hash160: hash160
});

const formatFunction = (func, opts = {}) => {
  const {
    numParams = 1,
    encoder,
    results = [],
    sync
  } = opts;
  const {
    input = toUint8Array,
    output = fromUint8Array
  } = encoder || {};

  const encode = (i, cps = a => a) => {
    if (!i--) return cps;

    const newCps = p => {
      p[i] = input(p[i]);
      return cps(p);
    };

    return encode(i, newCps);
  };

  const paramEncoder = encode(numParams);

  let encodeResult = res => output(res);

  if (!results) {
    encodeResult = res => res;
  } else if (results.length) {
    encodeResult = res => {
      for (const param of results) {
        res[param] = output(res[param]);
      }

      return res;
    };
  }

  let waitResult = async res => {
    res = await res;
    return encodeResult(res);
  };

  if (sync) waitResult = res => encodeResult(res);
  return (...params) => {
    const result = func(...paramEncoder(params));
    return waitResult(result);
  };
};
const formatByteSize = (originalByteSize, newByteSize, pad = originalByteSize > newByteSize) => data => {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxNum = (1 << newByteSize) - 1;

  for (let p = 0; p < data.length; ++p) {
    const value = data[p];

    if (value < 0 || value >> originalByteSize !== 0) {
      throw new Error('Wrong bit value');
    }

    acc = acc << originalByteSize | value;
    bits += originalByteSize;

    while (bits >= newByteSize) {
      bits -= newByteSize;
      ret.push(acc >> bits & maxNum);
    }
  }

  if (pad && bits > 0) {
    ret.push(acc << newByteSize - bits & maxNum);
  } else if (bits >= originalByteSize || acc << newByteSize - bits & maxNum) {
    throw new Error('Wrong bit value');
  }

  return ret;
};

var Formatter = /*#__PURE__*/Object.freeze({
  formatFunction: formatFunction,
  formatByteSize: formatByteSize
});

const secp256k1 = lazify(() => require('secp256k1'));
const encoder = {
  input: a => Buffer.from(a, 'hex'),
  output: a => a.toString('hex')
};
const publicKeyCreate = formatFunction(secp256k1.publicKeyCreate, {
  encoder
});
const signatureNormalize = formatFunction(secp256k1.signatureNormalize, {
  encoder
});
const signatureExport = formatFunction(secp256k1.signatureExport, {
  encoder
});
const privateKeyTweakAdd = formatFunction(secp256k1.privateKeyTweakAdd, {
  encoder,
  numParams: 2
});
const publicKeyTweakAdd = formatFunction(secp256k1.publicKeyTweakAdd, {
  encoder,
  numParams: 2
});
const verify = formatFunction(secp256k1.verify, {
  encoder,
  numParams: 3,
  results: null
});
const signature = formatFunction(secp256k1.sign, {
  encoder,
  numParams: 2,
  results: ['signature']
});
const sign = (message, privateKey) => signature(message, privateKey).then(({
  signature
}) => signature).then(signatureNormalize).then(signatureExport);

var Secp256k1 = /*#__PURE__*/Object.freeze({
  secp256k1: secp256k1,
  publicKeyCreate: publicKeyCreate,
  signatureNormalize: signatureNormalize,
  signatureExport: signatureExport,
  privateKeyTweakAdd: privateKeyTweakAdd,
  publicKeyTweakAdd: publicKeyTweakAdd,
  verify: verify,
  signature: signature,
  sign: sign
});

const SEED = '426974636f696e2073656564';
const HARDENED = 0x80000000;
const MAX_INDEX = 0xffffffff;
const TWEAK_OUT_OF_RANGE_ERROR = 'tweak out of range';

const hmac = (key, data) => {
  const hash = sha512Hmac(key, data);
  const left = hash.slice(0, 64);
  const right = hash.slice(64, 128);
  return {
    left,
    right
  };
};

const deriveKeyPoint = async ({
  privateKey,
  publicKey
} = {}, entropy, index = 0, hardened = false) => {
  if (index > MAX_INDEX) throw new Error('Index out of range.');
  let key = '';
  if (hardened && index < HARDENED) index += HARDENED;

  if (index >= HARDENED) {
    if (!privateKey) {
      throw new Error('Cannot get hardened chainCode without a private key.');
    }

    key = `00${privateKey}`;
  } else if (publicKey) {
    key = publicKey;
  } else if (privateKey) {
    key = await publicKeyCreate(privateKey, true);
  } else {
    throw new Error('Cannot derive without keys.');
  }

  key += index.toString(16).padStart(8, '0');
  const {
    left,
    right
  } = hmac(key, entropy);
  return {
    tweakPoint: left,
    chainCode: right,
    childIndex: index
  };
};
const derivePublic = async (publicKey, index, entropy, hardened = false) => {
  try {
    const keyPair = {
      publicKey
    };

    const _ref = await deriveKeyPoint(keyPair, entropy, index, hardened),
          {
      tweakPoint
    } = _ref,
          rest = _objectWithoutProperties(_ref, ["tweakPoint"]);

    const childKey = await publicKeyTweakAdd(publicKey, tweakPoint, true);
    return _objectSpread({
      publicKey: childKey
    }, rest);
  } catch (e) {
    if (!e.message.includes(TWEAK_OUT_OF_RANGE_ERROR)) throw e;
    return derivePublic(publicKey, index + 1, entropy, hardened);
  }
};
const derivePrivate = async (privateKey, index, entropy, hardened = false, publicKey) => {
  try {
    const keyPair = {
      privateKey,
      publicKey
    };

    const _ref2 = await deriveKeyPoint(keyPair, entropy, index, hardened),
          {
      tweakPoint
    } = _ref2,
          rest = _objectWithoutProperties(_ref2, ["tweakPoint"]);

    const childKey = await privateKeyTweakAdd(privateKey, tweakPoint);
    return _objectSpread({
      privateKey: childKey
    }, rest);
  } catch (e) {
    if (!e.message.includes(TWEAK_OUT_OF_RANGE_ERROR)) throw e;
    if (index > MAX_INDEX) index -= HARDENED;
    return derivePrivate(privateKey, index + 1, entropy, hardened, publicKey);
  }
};
const deriveKeyPair = async (parentKeys, keyIndex = '0') => {
  const hardened = keyIndex[keyIndex.length - 1] === "'";
  const index = hardened ? parseInt(keyIndex.slice(0, -1)) : parseInt(keyIndex);
  const {
    chainCode,
    privateKey
  } = parentKeys;
  let publicKey = parentKeys.publicKey;

  if ((hardened || index >= HARDENED) && !privateKey) {
    throw new Error('Cannot derive hardened index without a private key.');
  }

  if (privateKey) {
    const childKey = await derivePrivate(privateKey, index, chainCode, hardened, publicKey);
    const childPublicKey = await publicKeyCreate(childKey.privateKey, true);
    return _objectSpread({}, childKey, {
      publicKey: childPublicKey
    });
  }

  if (!publicKey) {
    if (!privateKey) throw new Error('Cannot derive without keys.');
    publicKey = await publicKeyCreate(privateKey, true);
  }

  return derivePublic(publicKey, index, chainCode, hardened);
};
const deriveMasterKeyPair = async seed => {
  const {
    left,
    right
  } = hmac(seed, SEED);
  const publicKey = await publicKeyCreate(left, true);
  return {
    privateKey: left,
    publicKey,
    chainCode: right,
    childIndex: 0
  };
};

var Derive = /*#__PURE__*/Object.freeze({
  SEED: SEED,
  HARDENED: HARDENED,
  MAX_INDEX: MAX_INDEX,
  TWEAK_OUT_OF_RANGE_ERROR: TWEAK_OUT_OF_RANGE_ERROR,
  deriveKeyPoint: deriveKeyPoint,
  derivePublic: derivePublic,
  derivePrivate: derivePrivate,
  deriveKeyPair: deriveKeyPair,
  deriveMasterKeyPair: deriveMasterKeyPair
});

const ALPHABETS = ['01', '01234567', '0123456789a', '0123456789abcdef', '0123456789ABCDEFGHJKMNPQRSTVWXYZ', '0123456789abcdefghijklmnopqrstuvwxyz', '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'];
const createCheckSumBase = (base, hashFunc) => ({
  encode: hexStr => {
    const checksum = (hashFunc || hash256)(hexStr);
    const checkHex = `${hexStr}${checksum.slice(0, 8)}`;
    return base.encode(checkHex);
  },
  decode: baseString => {
    const hexStr = base.decode(baseString);
    const payload = hexStr.slice(0, -8);
    const newChecksum = (hashFunc || hash256)(payload);
    const checksum = hexStr.slice(-8);
    if (newChecksum.startsWith(checksum)) return payload;
    throw new Error('Invalid checksum');
  }
});
const createHexEncoder = (base, hashFunc) => {
  const newBase = _objectSpread({}, base);

  const encode = newBase.encode;
  const decode = newBase.decode;

  newBase.encode = a => encode(buffer.Buffer.from(a, 'hex'));

  newBase.decode = a => decode(a).toString('hex');

  return _objectSpread({}, newBase, {
    check: createCheckSumBase(newBase, hashFunc)
  });
};
const base = ALPHABETS.reduce((decoders, alphabet) => {
  const baseDecoder = createHexEncoder(basex(alphabet));
  return _objectSpread({}, decoders, {
    [alphabet.length]: baseDecoder
  });
}, {});

var Base = /*#__PURE__*/Object.freeze({
  ALPHABETS: ALPHABETS,
  createCheckSumBase: createCheckSumBase,
  createHexEncoder: createHexEncoder,
  base: base
});

const bech32 = base['58'].check;
const bip32 = {
  purpose: 32,
  scriptType: 'P2PKH',
  xpriv: {
    stringPrefix: 'xprv',
    prefix: 0x0488ade4,
    decoder: base['58'].check
  },
  xpub: {
    stringPrefix: 'xpub',
    prefix: 0x0488b21e,
    decoder: base['58'].check
  },
  address: {
    prefix: 0x80,
    decoder: base['58'].check
  }
};
const bip44 = {
  purpose: 44,
  scriptType: 'P2PKH',
  xpriv: {
    stringPrefix: 'xprv',
    prefix: 0x0488ade4,
    decoder: base['58'].check
  },
  xpub: {
    stringPrefix: 'xpub',
    prefix: 0x0488b21e,
    decoder: base['58'].check
  },
  address: {
    prefix: 0x80,
    decoder: base['58'].check
  }
};
const bip49 = {
  purpose: 49,
  scriptType: 'P2WPKH-P2SH',
  xpriv: {
    stringPrefix: 'yprv',
    prefix: 0x049d7878,
    decoder: base['58'].check
  },
  xpub: {
    stringPrefix: 'ypub',
    prefix: 0x049d7cb2,
    decoder: base['58'].check
  },
  address: {
    prefix: 0x05,
    decoder: base['58'].check
  }
};
const bip84 = {
  purpose: 84,
  scriptType: 'P2WPKH',
  xpriv: {
    stringPrefix: 'zprv',
    prefix: 0x04b2430c,
    decoder: base['58'].check
  },
  xpub: {
    stringPrefix: 'zpub',
    prefix: 0x04b24746,
    decoder: base['58'].check
  },
  address: {
    prefix: 'bc',
    decoder: bech32
  }
};

const main = {
  magic: 0xd9b4bef9,
  bips: [44, 32],
  forks: [],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 0
  },
  addressPrefix: {},
  legacyAddressPrefix: {},
  replayProtection: {
    forkSighash: 0x00,
    forcedMinVersion: 0,
    forkId: 0
  },
  serializers: {
    address: base['58'].check,
    wif: base['58'].check,
    xkey: base['58'].check,
    txHash: hash256,
    sigHash: str => Buffer.from(hash256(str.toString('hex')), 'hex')
  },
  supportedHDPaths: [bip44, bip32]
};

const main$1 = {
  bips: [84, 49],
  forks: ['bitcoincash', 'bitcoingold', 'bitcoindiamond'],
  addressPrefix: {
    pubkeyhash: 0x00,
    scripthash: 0x05,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'bc'
  }
};
const testnet = _objectSpread({}, main$1, {
  magic: 0x0709110b,
  keyPrefix: {
    privkey: 0xef,
    xpubkey: 0x043587cf,
    xprivkey: 0x04358394,
    xpubkey58: 'tpub',
    xprivkey58: 'tprv',
    coinType: 1
  },
  addressPrefix: {
    pubkeyhash: 0x6f,
    scripthash: 0xc4,
    witnesspubkeyhash: 0x03,
    witnessscripthash: 0x28,
    bech32: 'tb'
  }
});

var bitcoin = /*#__PURE__*/Object.freeze({
  main: main$1,
  testnet: testnet
});

const main$2 = {
  magic: 0x0709110b,
  bips: [84, 49],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 156
  },
  addressPrefix: {
    pubkeyhash: 0x26,
    scripthash: 0x17,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'btg'
  },
  replayProtection: {
    forkSighash: 64,
    forcedMinVersion: 1,
    forkId: 79
  }
};
const testnet$1 = _objectSpread({}, main$2, {
  keyPrefix: {
    privkey: 0xef,
    xpubkey: 0x043587cf,
    xprivkey: 0x04358394,
    xpubkey58: 'tpub',
    xprivkey58: 'tprv',
    coinType: 156
  },
  addressPrefix: {
    pubkeyhash: 0x6f,
    scripthash: 0xc4,
    witnesspubkeyhash: 0x03,
    witnessscripthash: 0x28,
    bech32: 'tb'
  }
});

var bitcoingold = /*#__PURE__*/Object.freeze({
  main: main$2,
  testnet: testnet$1
});

const main$3 = {
  magic: 0xd9b4bef9,
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
  }
};

var bitcoinsv = /*#__PURE__*/Object.freeze({
  main: main$3
});

const main$4 = {
  magic: 0xd9b4bef9,
  keyPrefix: {
    privkey: 0xcc,
    xpubkey: 0x02fe52cc,
    xprivkey: 0x02fe52f8,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 5
  },
  addressPrefix: {
    pubkeyhash: 0x4c,
    scripthash: 0x10
  }
};

var dash = /*#__PURE__*/Object.freeze({
  main: main$4
});

const main$5 = {
  magic: 0xd9b4bef9,
  bips: [84, 49],
  keyPrefix: {
    privkey: 0x9e,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 20
  },
  addressPrefix: {
    pubkeyhash: 0x1e,
    scripthash: 0x3f,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'dgb'
  },
  legacyAddressPrefix: {
    scripthash: 0x05
  }
};

var digibyte = /*#__PURE__*/Object.freeze({
  main: main$5
});

const main$6 = {
  magic: 0x00000000,
  keyPrefix: {
    privkey: 0x9e,
    xpubkey: 0x02facafd,
    xprivkey: 0x02fac398,
    xprivkey58: 'xprv',
    xpubkey58: 'xpub',
    coinType: 3
  },
  addressPrefix: {
    pubkeyhash: 0x1e,
    scripthash: 0x16
  }
};

var dogecoin = /*#__PURE__*/Object.freeze({
  main: main$6
});

const main$7 = {
  magic: 0xd9b4bef9,
  bips: [84, 49],
  keyPrefix: {
    privkey: 0xb0,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 2
  },
  addressPrefix: {
    pubkeyhash: 0x5c,
    scripthash: 0x0a,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'ebst'
  },
  legacyAddressPrefix: {
    scripthash: 0x05
  }
};

var eboost = /*#__PURE__*/Object.freeze({
  main: main$7
});

const main$8 = {
  magic: 0xd9b4bef9,
  bips: [84, 49],
  keyPrefix: {
    privkey: 0x8e,
    xpubkey: 0x0488bc26,
    xprivkey: 0x0488daee,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 8
  },
  addressPrefix: {
    pubkeyhash: 0x0e,
    scripthash: 0x05,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'fc'
  }
};

var feathercoin = /*#__PURE__*/Object.freeze({
  main: main$8
});

const main$9 = {
  magic: 0xd9b4bef9,
  bips: [84, 49],
  keyPrefix: {
    privkey: 0xb0,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 2
  },
  addressPrefix: {
    pubkeyhash: 0x30,
    scripthash: 0x32,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'lc'
  },
  legacyAddressPrefix: {
    scripthash: 0x05
  }
};

var litecoin = /*#__PURE__*/Object.freeze({
  main: main$9
});

const main$a = {
  magic: 0xf1cfa6d3,
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 2301
  },
  addressPrefix: {
    pubkeyhash: 0x3a,
    scripthash: 0x32
  }
};

var qtum = /*#__PURE__*/Object.freeze({
  main: main$a
});

const main$b = {
  magic: 0xfcd9b7dd,
  bips: [84, 49, 44, 32],
  keyPrefix: {
    privkey: 0x9b,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 202
  },
  addressPrefix: {
    pubkeyhash: 0x1b,
    scripthash: 0x44,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'uf'
  },
  legacyAddressPrefix: {
    scripthash: 0x05
  }
};

var uniformfiscalobject = /*#__PURE__*/Object.freeze({
  main: main$b
});

const main$c = {
  magic: 0xd9b4bef9,
  bips: [84, 49, 44, 32],
  forks: [],
  keyPrefix: {
    privkey: 0x80,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 28
  },
  addressPrefix: {
    pubkeyhash: 0x47,
    scripthash: 0x05,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'vtc'
  }
};

var vertcoin = /*#__PURE__*/Object.freeze({
  main: main$c
});

const main$d = {
  magic: 0xd9b4bef9,
  keyPrefix: {
    privkey: 0xd2,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4,
    xpubkey58: 'xpub',
    xprivkey58: 'xprv',
    coinType: 136
  },
  addressPrefix: {
    pubkeyhash: 0x52,
    scripthash: 0x7
  }
};

var zcoin = /*#__PURE__*/Object.freeze({
  main: main$d
});



var Networks = /*#__PURE__*/Object.freeze({
  bitcoin: bitcoin,
  bitcoinsv: bitcoinsv,
  dogecoin: dogecoin,
  qtum: qtum,
  vertcoin: vertcoin,
  dash: dash,
  eboost: eboost,
  zcoin: zcoin,
  bitcoingold: bitcoingold,
  digibyte: digibyte,
  feathercoin: feathercoin,
  litecoin: litecoin,
  uniformfiscalobject: uniformfiscalobject
});

const createInfo = info => {
  const newNetwork = {};

  for (const set in main) {
    const mainSet = main[set];
    const infoSet = info[set];

    if (Array.isArray(mainSet)) {
      newNetwork[set] = (infoSet || []).concat(mainSet).filter((v, i, s) => s.indexOf(v) === i);
    } else if (typeof mainSet === 'object') {
      newNetwork[set] = _objectSpread({}, mainSet, infoSet || {});
    } else if (typeof infoSet !== 'undefined') {
      newNetwork[set] = infoSet;
    } else newNetwork[set] = mainSet;
  }

  return newNetwork;
};
const createNetworks = newInfos => {
  const networks = {
    main
  };

  for (const network in newInfos) {
    const infos = newInfos[network];

    for (const networkType in infos) {
      const partialInfo = infos[networkType];
      let name = network;
      if (networkType !== 'main') name += networkType.toLowerCase();
      networks[name] = createInfo(partialInfo);
    }
  }

  return networks;
};
const networks = createNetworks(Networks);
const addNetworks = newInfos => Object.assign(networks, createNetworks(newInfos));
const getExtendedKeyVersion = (hdKey, network = 'main') => {
  const {
    keyPrefix = {}
  } = networks[network];
  if (hdKey.privateKey) return keyPrefix.xprivkey;
  if (hdKey.publicKey) return keyPrefix.xpubkey;
  throw new Error("Can't get version without a key");
};
const getNetworkForVersion = version => {
  for (const network in networks) {
    try {
      checkVersion(version, network);
      return network;
    } catch (e) {}
  }

  throw new Error('Unknown network version');
};
const checkVersion = (version, network = 'main') => {
  const {
    keyPrefix = {}
  } = networks[network];

  if (version) {
    for (const prefix in keyPrefix) {
      if (keyPrefix[prefix] === version) return version;
    }

    throw new Error('Wrong key prefix for network');
  }
};
const getPrefixType = (prefixNum, network = 'main') => {
  const getPrefix = addressPrefix => {
    for (const prefixType in addressPrefix) {
      if (addressPrefix[prefixType] === prefixNum) {
        return prefixType;
      }
    }

    return null;
  };

  const {
    addressPrefix,
    legacyAddressPrefix
  } = networks[network];
  const type = getPrefix(addressPrefix) || getPrefix(legacyAddressPrefix);

  if (!type) {
    throw new Error(`Unknown prefix ${prefixNum} for network ${network}`);
  }

  return type;
};
const getPrefixNum = (type, network = 'main') => {
  const {
    addressPrefix,
    legacyAddressPrefix
  } = networks[network];
  const cashAddress = addressPrefix.cashAddress;
  return !cashAddress ? addressPrefix[type] : legacyAddressPrefix[type];
};
const getHDSetting = (network, value) => {
  const {
    supportedHDPaths
  } = networks[network];
  console.log('getHDSetting network:', network, ' supportedHDPaths:', supportedHDPaths);

  for (const hdSetting of supportedHDPaths) {
    for (const key in hdSetting) {
      console.log('getHDSetting purpose:', hdSetting.purpose, ' key:', key);
      const setting = hdSetting[key]; // checking if address that has legacy

      if (Array.isArray(setting)) {
        return setting.find(({
          prefix,
          stringPrefix
        }) => prefix === value || stringPrefix === value);
      } // checking if xpub, xpriv, or address


      if (typeof setting === 'object' && (setting.prefix === value || setting.stringPrefix === value)) {
        return hdSetting;
      } // if scriptType or purpose


      if (setting === value) return hdSetting;
    }
  }

  throw new Error(`Wrong value: ${value} for network: ${network}`);
};
const getScriptType = (prefixNum, network = 'main') => {
  const setting = getHDSetting(network, prefixNum);

  if (!setting) {
    throw new Error(`Unknown address prefix ${prefixNum} for network ${network}`);
  }

  return setting.scriptType;
};

var NetworkInfo = /*#__PURE__*/Object.freeze({
  createInfo: createInfo,
  createNetworks: createNetworks,
  networks: networks,
  addNetworks: addNetworks,
  getExtendedKeyVersion: getExtendedKeyVersion,
  getNetworkForVersion: getNetworkForVersion,
  checkVersion: checkVersion,
  getPrefixType: getPrefixType,
  getPrefixNum: getPrefixNum,
  getHDSetting: getHDSetting,
  getScriptType: getScriptType
});

const fromHex = keyHex => {
  if (keyHex.length !== 66 && keyHex.length !== 132) {
    throw new Error('Wrong key pair length');
  }

  const firstHeaderByte = parseInt(keyHex.slice(0, 2), 16);

  try {
    if (firstHeaderByte !== 0) throw new Error('Bad Private key prefix');
    const keyPair = {
      privateKey: keyHex.slice(2, 66)
    };

    if (keyHex.length === 132) {
      const secondHeaderByte = parseInt(keyHex.slice(66, 68), 16);

      if (secondHeaderByte !== 2 && secondHeaderByte !== 3) {
        throw new Error('Bad Public key prefix');
      }

      const pub = {
        publicKey: keyHex.slice(68, 132)
      };
      Object.assign(keyPair, pub);
    }

    return keyPair;
  } catch (e) {
    if (firstHeaderByte !== 2 && firstHeaderByte !== 3) {
      throw new Error('Bad Public key prefix');
    }

    return {
      publicKey: keyHex.slice(0, 66)
    };
  }
};
const privateFromWIF = (wif, network = 'main') => {
  const {
    serializers,
    keyPrefix
  } = networks[network];
  const keyHex = serializers.wif.decode(wif);

  if (parseInt(keyHex.slice(0, 2), 16) !== keyPrefix.privkey) {
    throw new Error(`Unknown key prefix ${keyHex.slice(0, 2)} for network ${network}`);
  }

  const privateKey = keyHex.slice(2, 66);
  let compress = false;

  if (keyHex.length >= 68) {
    if (parseInt(keyHex.slice(66, 68), 16) !== 1) {
      throw new Error(`Unknown compression flag ${keyHex.slice(66, 68)}`);
    }

    compress = true;
  }

  return {
    privateKey,
    compress
  };
};
const fromWif = async (wif, network = 'main') => {
  const {
    privateKey,
    compress
  } = privateFromWIF(wif, network);
  const publicKey = await publicKeyCreate(privateKey, compress);
  return {
    privateKey,
    publicKey
  };
};
const toHex = keyPair => {
  const publicKey = keyPair.publicKey || '';
  const privateKey = keyPair.privateKey ? `00${keyPair.privateKey}` : '';
  return `${privateKey}${publicKey}`;
};
const sign$1 = async (keyPair, msg) => {
  if (!keyPair.privateKey) throw new Error('Cannot sign without private key.');
  return sign(msg, keyPair.privateKey);
};
const verify$1 = async (keyPair, msg, signature$$1) => {
  let publicKey = keyPair.publicKey;

  if (!publicKey && keyPair.privateKey) {
    publicKey = await publicKeyCreate(keyPair.privateKey, true);
  } else {
    throw new Error('Cannot verify without keys.');
  }

  const verified = await verify(msg, signature$$1, publicKey);
  return verified;
};

var KeyPair = /*#__PURE__*/Object.freeze({
  fromHex: fromHex,
  privateFromWIF: privateFromWIF,
  fromWif: fromWif,
  toHex: toHex,
  sign: sign$1,
  verify: verify$1
});

const MAX_DEPTH = 0xff;
const fromSeed = async (seed, network) => {
  const masterKeyPair = await deriveMasterKeyPair(seed);
  return _objectSpread({}, masterKeyPair, {
    parentFingerPrint: 0,
    version: getExtendedKeyVersion(masterKeyPair, network),
    depth: 0
  });
};
const fromIndex = async (parentKeys, index, network) => {
  if (parentKeys.depth >= MAX_DEPTH) throw new Error('Depth too high.');
  const derivedKey = await deriveKeyPair(parentKeys, index);

  if (!parentKeys.publicKey) {
    if (!parentKeys.privateKey) {
      throw new Error('Cannot create parentFingerPrint without keys');
    }

    parentKeys.publicKey = await publicKeyCreate(parentKeys.privateKey, true);
  }

  const parentFingerPrint = await hash160(parentKeys.publicKey);
  network = network || getNetworkForVersion(parentKeys.version);
  return _objectSpread({}, derivedKey, {
    parentFingerPrint: parseInt(parentFingerPrint.slice(0, 8), 16),
    version: getExtendedKeyVersion(derivedKey, network),
    depth: parentKeys.depth + 1
  });
};
const fromHex$1 = (keyHex, network) => {
  const version = parseInt(keyHex.slice(0, 8), 16);
  if (network) checkVersion(version, network);
  return _objectSpread({
    version,
    depth: parseInt(keyHex.slice(9, 10), 16),
    parentFingerPrint: parseInt(keyHex.slice(10, 18), 16),
    childIndex: parseInt(keyHex.slice(18, 26), 16),
    chainCode: keyHex.slice(26, 90)
  }, fromHex(keyHex.slice(90, 156)));
};
const fromString = (hdKey, network = 'main') => {
  const keyHex = networks[network].serializers['xkey'].decode(hdKey);
  return fromHex$1(keyHex, network);
};
const toHex$1 = (hdKey, network, forcePublic = false) => {
  if (network) checkVersion(hdKey.version, network);
  const {
    privateKey,
    publicKey
  } = hdKey;
  const keyPair = {
    publicKey
  };
  if (!forcePublic) keyPair.privateKey = privateKey;
  return getExtendedKeyVersion(keyPair, network).toString(16).padStart(8, '0') + hdKey.depth.toString(16).padStart(2, '0') + hdKey.parentFingerPrint.toString(16).padStart(8, '0') + hdKey.childIndex.toString(16).padStart(8, '0') + hdKey.chainCode + toHex(keyPair).slice(0, 66);
};
const toString = (hdKey, network = 'main', forcePublic = false) => {
  const keyHex = toHex$1(hdKey, network, forcePublic);
  return networks[network].serializers['xkey'].encode(keyHex);
};

var ExtendedKey = /*#__PURE__*/Object.freeze({
  fromSeed: fromSeed,
  fromIndex: fromIndex,
  fromHex: fromHex$1,
  fromString: fromString,
  toHex: toHex$1,
  toString: toString
});

const fromSeed$1 = async (seed, network) => {
  const masterKeyPair = await fromSeed(seed, network);
  return _objectSpread({}, masterKeyPair, {
    hardened: false,
    path: ['m'],
    children: {}
  });
};
const fromExtendedKey = (keyPair, hdPath) => {
  const hardened = keyPair.childIndex >= HARDENED;
  const {
    path: parentPath = []
  } = hdPath || {};
  let indexStr = 'm';
  const path = [...parentPath];

  if (keyPair.depth) {
    const index = keyPair.childIndex;
    const adjIndex = hardened ? index - HARDENED : index;
    indexStr = `${adjIndex}${hardened ? "'" : ''}`;
  }

  if (path[0] !== 'm') path.unshift('m');

  if (path.length === keyPair.depth) {
    path.push(indexStr);
  }

  if (path.length !== keyPair.depth + 1) {
    throw new Error('Wrong path depth for key');
  }

  if (path[path.length - 1] !== indexStr) {
    throw new Error('Wrong index for key');
  }

  const hdKey = _objectSpread({}, keyPair, {
    path,
    hardened,
    children: {}
  });

  const {
    scriptType,
    chain
  } = hdPath || {};
  if (scriptType) hdKey.scriptType = scriptType;
  if (chain) hdKey.chain = chain;
  return hdKey;
};
const fromIndex$1 = async (parentKey, index, network) => {
  // Derive an ExtendedKey key from the current parentKey and index
  const childKey = await fromIndex(parentKey, index, network);

  const childHDPath = _objectSpread({}, parentKey, {
    path: [...parentKey.path, index] // Create an HD key from the ExtendedKey

  });

  return fromExtendedKey(childKey, childHDPath);
};
const fromPath = async (parentKeys, hdPath, network) => {
  // Get the deepest possible parent for this key
  const parent = getParentKey(parentKeys, hdPath.path); // Set the starting derivation key to be the parent key from before

  let childHDKey = parent.key;

  while (parent.path.length) {
    // Get next child key
    const index = parent.path.shift();
    const childKey = await fromIndex$1(childHDKey, index, network); // Add the new key to the current parent key and change the pointer

    childHDKey.children[index] = childKey;
    childHDKey = childKey;
  } // Set the scriptType and chain for the deepest path


  childHDKey.scriptType = hdPath.scriptType || 'P2PKH';
  childHDKey.chain = hdPath.chain || 'external';
  return parentKeys;
};
const fromPaths = async (parentKey, hdPaths, network) => {
  // If we get a seed create a master hd key from it
  if (typeof parentKey === 'string') {
    parentKey = await fromSeed$1(parentKey, network);
  } // Create All missing key paths


  for (const hdPath of hdPaths) {
    parentKey = await fromPath(parentKey, hdPath);
  }

  return parentKey;
};
const fromString$1 = (extendedKey, hdPath, network) => {
  const keyPair = fromString(extendedKey, network);
  return fromExtendedKey(keyPair, hdPath);
};
const getParentKey = (parentKey, path) => {
  const tempPath = [...path];
  tempPath.shift();

  while (parentKey.children[tempPath[0]] && tempPath.length) {
    parentKey = parentKey.children[tempPath.shift()];
  }

  return {
    key: parentKey,
    path: tempPath
  };
};
const getKey = (parentKey, path) => {
  const tempPath = [...path];
  tempPath.shift();

  while (parentKey && tempPath.length) {
    parentKey = parentKey.children[tempPath.shift()];
  }

  return parentKey;
};
const createPath = (account = 0, parent = {
  path: ['m']
}, hardened) => {
  const {
    chain = 'external',
    scriptType = 'P2PKH'
  } = parent;
  const accountStr = `${account}${hardened ? "'" : ''}`;
  const index = chain === 'external' ? '0' : '1';
  const path = [...parent.path, accountStr, index];
  return {
    path,
    chain,
    scriptType
  };
};
const toString$1 = toString;

var HDKey = /*#__PURE__*/Object.freeze({
  fromSeed: fromSeed$1,
  fromExtendedKey: fromExtendedKey,
  fromIndex: fromIndex$1,
  fromPath: fromPath,
  fromPaths: fromPaths,
  fromString: fromString$1,
  getParentKey: getParentKey,
  getKey: getKey,
  createPath: createPath,
  toString: toString$1
});

const createPaths = (purpose, coinType = 0, account = 0, network = 'main') => {
  if (!purpose) purpose = networks[network].bips;

  if (Array.isArray(purpose)) {
    const paths = [];

    for (const p of purpose) {
      paths.push(...createPaths(p, coinType, account));
    }

    return paths;
  }

  if (purpose === 32) return [createPath(account)];
  const scriptType = ScriptTypes[`${purpose}`];
  if (!scriptType) throw new Error(`Unknown derivation purpose ${purpose}`);
  const path = ['m', `${purpose}'`, `${coinType || 0}'`];
  const hdPath = {
    path,
    scriptType
  };

  const hdPathInt = _objectSpread({}, hdPath, {
    chain: 'internal'
  });

  return [createPath(account, hdPath, true), createPath(account, hdPathInt, true)];
};
const ScriptTypes = {
  '44': 'P2PKH',
  '49': 'P2WPKH-P2SH',
  '84': 'P2WPKH'
};

var Paths = /*#__PURE__*/Object.freeze({
  createPaths: createPaths,
  ScriptTypes: ScriptTypes
});

const persist = (save, load, delay = 100, cache = {}, data = cache, status = {}) => {
  return new Proxy(Object.assign(() => save(cache), data), {
    apply: async (target, thisArgs, args) => {
      const updateCache = newCache => {
        cache = newCache;
        data = newCache;

        for (const key in target) {
          if (data[key] === undefined) {
            delete target[key];
          }
        }

        Object.assign(target, newCache);
      }; // Try to load the cache from disk in case it never happend before


      if (!status.loaded) {
        const rawData = typeof load === 'function' ? await load() : load;
        updateCache(_objectSpread({}, rawData, cache));
        status.loaded = true;
      } // Load/Stop the cache based on the argument


      if (args && args.length) {
        if (typeof args[0] === 'object') updateCache(_objectSpread({}, args[0]));else if (args[0] === 'stop') {
          if (status.saving) {
            clearTimeout(status.saving);
            status.saving = null;
          }

          status.changed = false;
          await Reflect.apply(target, target, []);
          return;
        }
      } // Stop looping in case nothing changed or we already have a save timer


      if (!status.changed || status.saving) return; // If something changed, set flags and call save

      status.changed = false; // Set save loop after the desired delay

      status.saving = setTimeout(() => {
        if (status.saving) {
          clearTimeout(status.saving);
          status.saving = null;
        }

        Reflect.apply(thisArgs, thisArgs, []);
      }, delay);
      await Reflect.apply(target, target, []);
    },
    set: (target, prop, value, receiver) => {
      // Only update/save if the param actually changed
      if (data[prop] !== value) {
        Reflect.set(data, prop, value);
        Reflect.set(target, prop, value);
        status.changed = true;
        if (!status.saving) Reflect.apply(receiver, receiver, []);
      }

      return true;
    },
    get: (target, prop) => {
      if (prop === 'status') return status; // Get the value

      const value = Reflect.get(data, prop); // Return any non object values

      if (typeof value !== 'object') return value; // Create a proxy from the child to trimgger saves on the top parent

      return persist(save, load, delay, cache, value, status);
    }
  });
};

var Persister = /*#__PURE__*/Object.freeze({
  persist: persist
});

const Networks$1 = networks;
const Core = {
  KeyPair,
  Networks: Networks$1,
  NetworkInfo
};
const HD = {
  Derive,
  ExtendedKey,
  HDKey,
  Paths
};
const Utils = {
  Base,
  Formatter,
  Hash,
  Require,
  Secp256k1,
  Persister,
  UintArray
};

exports.Core = Core;
exports.HD = HD;
exports.Utils = Utils;
//# sourceMappingURL=index.js.map
