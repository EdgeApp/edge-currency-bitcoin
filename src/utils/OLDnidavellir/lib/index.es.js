import { Buffer as Buffer$1 } from 'buffer';
import basex from 'base-x';

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
const digestHmac = (hmac, hash) => (key, data) => {
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

  newBase.encode = a => encode(Buffer$1.from(a, 'hex'));

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
const base58 = base['58'].check;
const HDPaths = {
  '32': {
    scriptType: 'P2PKH',
    xpriv: {
      prefix: 0x0488ade4,
      stringPrefix: 'xprv',
      decoder: _objectSpread({}, base58, {
        base: 'xprv'
      })
    },
    xpub: {
      prefix: 0x0488b21e,
      stringPrefix: 'xpub',
      decoder: _objectSpread({}, base58, {
        base: 'xpub'
      })
    },
    address: {
      prefix: 0x80,
      stringPrefix: '1',
      decoder: _objectSpread({}, base58, {
        base: '1'
      })
    }
  },
  '44': {
    scriptType: 'P2PKH',
    xpriv: {
      prefix: 0x0488ade4,
      stringPrefix: 'xprv',
      decoder: _objectSpread({}, base58, {
        base: 'xprv'
      })
    },
    xpub: {
      prefix: 0x0488b21e,
      stringPrefix: 'xpub',
      decoder: _objectSpread({}, base58, {
        base: 'xpub'
      })
    },
    address: {
      prefix: 0x80,
      stringPrefix: '1',
      decoder: _objectSpread({}, base58, {
        base: '1'
      })
    }
  },
  '49': {
    scriptType: 'P2WPKH-P2SH',
    xpriv: {
      prefix: 0x049d7878,
      stringPrefix: 'yprv',
      decoder: base58
    },
    xpub: {
      prefix: 0x049d7cb2,
      stringPrefix: 'ypub',
      decoder: base58
    },
    address: {
      prefix: 0x05,
      stringPrefix: '3',
      decoder: base58
    }
  },
  '84': {
    scriptType: 'P2WPKH',
    xpriv: {
      prefix: 0x04b2430c,
      stringPrefix: 'zprv',
      decoder: base58
    },
    xpub: {
      prefix: 0x04b24746,
      stringPrefix: 'zpub',
      decoder: base58
    },
    address: {
      prefix: -1,
      stringPrefix: 'bc',
      decoder: bech32
    }
  }
};
const main = {
  coinType: 0,
  wif: {
    prefix: 0x80,
    stringPrefix: '1',
    decoder: base['58'].check
  },
  HDPaths,
  DefaultHDPath: 44,
  txHash: hash256,
  sigHash: str => Buffer.from(hash256(str.toString('hex')), 'hex')
};

const main$1 = {
  DefaultHDPath: 84
};
const testnet = {
  coinType: 1,
  wif: 0xef,
  HDPaths: {
    '32': {
      xpriv: {
        prefix: 0x04358394,
        stringPrefix: 'tprv'
      },
      xpub: {
        prefix: 0x043587cf,
        stringPrefix: 'tpub'
      },
      address: 0x6f
    },
    '44': {
      xpriv: {
        prefix: 0x04358394,
        stringPrefix: 'tprv'
      },
      xpub: {
        prefix: 0x043587cf,
        stringPrefix: 'tpub'
      },
      address: 0x6f
    },
    '49': {
      xpriv: {
        prefix: 0x04358394,
        stringPrefix: 'tprv'
      },
      xpub: {
        prefix: 0x043587cf,
        stringPrefix: 'tpub'
      },
      address: 0xc4
    },
    '84': {
      xpriv: {
        prefix: 0x04358394,
        stringPrefix: 'tprv'
      },
      xpub: {
        prefix: 0x043587cf,
        stringPrefix: 'tpub'
      },
      address: 'tb'
    }
  }
};

var bitcoin = /*#__PURE__*/Object.freeze({
  main: main$1,
  testnet: testnet
});



var Networks = /*#__PURE__*/Object.freeze({
  bitcoin: bitcoin
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
const addNetworks = newInfos => Object.assign(networks, createNetworks(newInfos)); // /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////
// /////////////////

const getHDSetting = (value, network) => {
  // If no network is specified, check all available networks
  if (!network) {
    for (const network in networks) {
      try {
        return getHDSetting(value, network);
      } catch (e) {}
    }

    throw new Error('Unknown prefix');
  }

  const {
    HDPaths
  } = networks[network];

  for (const purpose in HDPaths) {
    const hdPath = HDPaths[purpose];

    for (const key in hdPath) {
      const setting = hdPath[key]; // checking if address that has legacy

      if (Array.isArray(setting)) {
        return setting.find(({
          prefix,
          stringPrefix
        }) => prefix === value || stringPrefix === value);
      } // checking if xpub, xpriv, or address


      if (typeof setting === 'object' && (setting.prefix === value || setting.stringPrefix === value)) {
        return hdPath;
      } // if scriptType or purpose


      if (setting === value) return hdPath;
    }
  }

  throw new Error(`Wrong value: ${value} for network: ${network}`);
};
const getDecoder = (network, value) => {
  const hdPath = getHDSetting(value, network);

  for (const key in hdPath) {
    const decoder = hdPath[key];

    if (Array.isArray(decoder)) {
      return decoder.find(({
        prefix,
        stringPrefix
      }) => prefix === value || stringPrefix === value);
    }

    if (decoder.prefix === value || decoder.stringPrefix === value) {
      return decoder.decoder;
    }
  }

  throw new Error(`Wrong value: ${value} for network: ${network}`);
};

var NetworkInfo = /*#__PURE__*/Object.freeze({
  createInfo: createInfo,
  createNetworks: createNetworks,
  networks: networks,
  addNetworks: addNetworks,
  getHDSetting: getHDSetting,
  getDecoder: getDecoder
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

const fromWIF = (wif, network = 'main') => {
  const {
    prefix,
    decoder
  } = networks[network].wif;
  const keyHex = decoder.decode(wif);

  if (parseInt(keyHex.slice(0, 2), 16) !== prefix) {
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
const toWIF = (privateKey, network = 'main', compress = true) => {
  if (privateKey.length !== 64) throw new Error(`Wrong key length`);
  const {
    prefix,
    decoder
  } = networks[network].wif;
  const prefixStr = prefix.toString(16);
  const compressFlag = compress ? '01' : '';
  const hexKey = `${prefixStr}${privateKey}${compressFlag}`;
  return decoder.encode(hexKey);
};
const toPublic = async (privateKey, compress = true) => publicKeyCreate(privateKey, compress);
const toSignature = async (privateKey, msg) => sign(msg, privateKey);
const verify$1 = async (msg, signature$$1, publicKey, privateKey) => {
  if (!publicKey) {
    if (!privateKey) throw new Error('Cannot verify without keys.');
    publicKey = await publicKeyCreate(privateKey, true);
  }

  const verified = await verify(msg, signature$$1, publicKey);
  return verified;
};

var PrivateKey = /*#__PURE__*/Object.freeze({
  fromWIF: fromWIF,
  toWIF: toWIF,
  toPublic: toPublic,
  toSignature: toSignature,
  verify: verify$1
});

// // 
// import {
//   type ExtendedKey,
//   type HDKey
// } from '../../types/hd.js'
// import * as Private from './private.js'
// import * as Public from './public.js'
// import { fromNumber, toNumber } from './path.js'
// // export const fromExtendedKey
// // export const fromSeed
// // export const fromHex
// // export const fromString
// // export const fromIndex
// // export const fromPath
// // export const toHex
// // export const toString
// // export const toPublic
// export const fromHDKey = (hdKey: $Shape<HDKey>, network?: string): HDKey => {
//   const { path: parentPath = [] } = hdPath || {}
//   let indexStr = 'm'
//   const path = [...parentPath]
//   if (keyPair.depth) {
//     indexStr = fromNumber(keyPair.childNumber)
//   }
//   if (path[0] !== 'm') path.unshift('m')
//   if (path.length === keyPair.depth) {
//     path.push(indexStr)
//   }
//   if (path.length !== keyPair.depth + 1) {
//     throw new Error('Wrong path depth for key')
//   }
//   if (path[path.length - 1] !== indexStr) {
//     throw new Error('Wrong index for key')
//   }
//   const hdKey: HDKey = { ...keyPair, path, children: {} }
//   return hdKey
// }
// export const fromExtendedKey = (
//   keyPair: ExtendedKey,
//   hdPath?: HDPath
// ): HDKey => {
//   const { path: parentPath = [] } = hdPath || {}
//   let indexStr = 'm'
//   const path = [...parentPath]
//   if (keyPair.depth) {
//     indexStr = fromNumber(keyPair.childNumber)
//   }
//   if (path[0] !== 'm') path.unshift('m')
//   if (path.length === keyPair.depth) {
//     path.push(indexStr)
//   }
//   if (path.length !== keyPair.depth + 1) {
//     throw new Error('Wrong path depth for key')
//   }
//   if (path[path.length - 1] !== indexStr) {
//     throw new Error('Wrong index for key')
//   }
//   const hdKey: HDKey = { ...keyPair, path, children: {} }
//   return hdKey
// }
// export const fromSeed = async (
//   seed: string,
//   network?: string
// ): Promise<HDKey> => {
//   const privateKey = Private.fromSeed(seed)
//   const { publicKey } = await Private.toPublic(privateKey, network)
//   return { ...privateKey, publicKey, children: {} }
// }
// export const fromParent = async (
//   parentKey: HDKey,
//   index: Index,
//   network?: string
// ): Promise<HDKey> => {
//   let child
//   const indexNum = toNumber(index)
//   if (parentKey.privateKey) {
//     child = await Private.toChild({ ...parentKey }, indexNum)
//   } else {
//     child = await Public.toChild({ ...parentKey }, indexNum)
//   }
//   const childHDPath = {
//     ...parentKey,
//     path: [...parentKey.path, index]
//   }
//   // Create an HD key from the ExtendedKey
//   return fromExtendedKey(child, childHDPath)
// }
// export const fromPath = async (
//   parentKeys: HDKey,
//   hdPath: HDPath,
//   network?: string
// ): Promise<HDKey> => {
//   // Get the deepest possible parent for this key
//   const parent = getParentKey(parentKeys, hdPath.path)
//   // Set the starting derivation key to be the parent key from before
//   let childHDKey = parent.key
//   while (parent.path.length) {
//     // Get next child key
//     const index = parent.path.shift()
//     const childKey = await fromParent(childHDKey, index, network)
//     // Add the new key to the current parent key and change the pointer
//     childHDKey.children[index] = childKey
//     childHDKey = childKey
//   }
//   return parentKeys
// }
// export const fromPaths = async (
//   parentKey: HDKey | string,
//   hdPaths: Array<HDPath>,
//   network?: string
// ): Promise<HDKey> => {
//   // If we get a seed create a master hd key from it
//   if (typeof parentKey === 'string') {
//     parentKey = await fromSeed(parentKey, network)
//   }
//   // Create All missing key paths
//   for (const hdPath of hdPaths) {
//     parentKey = await fromPath(parentKey, hdPath)
//   }
//   return parentKey
// }
// export const fromString = (
//   extendedKey: string,
//   hdPath?: HDPath,
//   network?: string
// ): HDKey => {
//   let xKey
//   try {
//     xKey = Private.fromString(extendedKey, network)
//   } catch (e) {
//     xKey = Public.fromString(extendedKey, network)
//   }
//   return fromExtendedKey(xKey, hdPath)
// }
// export const getParentKey = (
//   parentKey: HDKey,
//   path: Path
// ): { key: HDKey, path: Path } => {
//   const tempPath = [...path]
//   tempPath.shift()
//   while (parentKey.children[tempPath[0]] && tempPath.length) {
//     parentKey = parentKey.children[tempPath.shift()]
//   }
//   return { key: parentKey, path: tempPath }
// }
// export const getKey = (parentKey: HDKey, path: Path): HDKey | null => {
//   const tempPath = [...path]
//   tempPath.shift()
//   while (parentKey && tempPath.length) {
//     parentKey = parentKey.children[tempPath.shift()]
//   }
//   return parentKey
// }

var HDKey = /*#__PURE__*/Object.freeze({

});

const HARDENED = 0x80000000;
const SEED = '426974636f696e2073656564';
const MAX_INDEX = 0xffffffff;
const MAX_DEPTH = 0xff;
const TWEAK_OUT_OF_RANGE_ERROR = 'tweak out of range';
const XKEY_DEFAULTS = {
  childNumber: 0,
  parentFingerPrint: 0,
  depth: 0
};
const dataToHex = data => data.version.toString(16).padStart(8, '0') + data.depth.toString(16).padStart(2, '0') + data.parentFingerPrint.toString(16).padStart(8, '0') + data.childNumber.toString(16).padStart(8, '0') + data.chainCode;
const dataFromHex = (keyHex, network) => {
  // Check the entire hex length
  if (keyHex.length !== 156) throw new Error('Wrong key length'); // Check that the key prefix matches the network's prefix if given a network

  const version = parseInt(keyHex.slice(0, 8), 16);

  if (network) {
    const setting = getHDSetting(version, network);
    if (!setting) throw new Error('Wrong extended key version for network');
  }

  return {
    version,
    depth: parseInt(keyHex.slice(9, 10), 16),
    parentFingerPrint: parseInt(keyHex.slice(10, 18), 16),
    childNumber: parseInt(keyHex.slice(18, 26), 16),
    chainCode: keyHex.slice(26, 90)
  };
};

const isNumeric = str => /^-{0,1}\d+$/.test(str);

const fromNumber = (index, harden = false) => {
  if (index > MAX_INDEX) throw new Error(`Index out of range: ${index}`); // If it's a harden index, we need to set the flag and normalize the index

  if (index >= HARDENED) {
    harden = true;
    index = index - HARDENED;
  }

  return harden ? `${index}'` : `${index}`;
};
const toNumber = index => {
  // Check for hardened flag
  const hardened = index[index.length - 1] === '\''; // If hardened, we need to remove the harden flag

  if (hardened) index = index.slice(0, -1); // Index must be a number

  if (!isNumeric(index)) throw new Error(`Index must be a number: ${index}`);
  let indexNumber = parseInt(index); // If hardened, we need to add the HARDENED param to the index

  if (hardened) indexNumber += HARDENED;
  if (indexNumber > MAX_INDEX) throw new Error(`Index out of range: ${indexNumber}`);
  return indexNumber;
};
const toString = path => {
  try {
    return 'm/' + path.map(a => fromNumber(a)).join('/');
  } catch (e) {
    e.message = `Bad path: ${JSON.stringify(path)}\n\t${e.message}`;
    throw e;
  }
};
const fromString = (path, root = 'm') => {
  try {
    const pathArr = path.split('/');
    const pathRoot = pathArr.shift();
    if (pathRoot !== root) throw new Error(`Unknown path root: '${pathRoot}', expected: '${root}'`);
    return pathArr.map(toNumber);
  } catch (e) {
    e.message = `Bad path: ${path}\n\t${e.message}`;
    throw e;
  }
};

var Path = /*#__PURE__*/Object.freeze({
  fromNumber: fromNumber,
  toNumber: toNumber,
  toString: toString,
  fromString: fromString
});

const fromPrivate = (key, network) => {
  const {
    privateKey,
    chainCode
  } = key;
  if (!privateKey) throw new Error('Missing private key');
  if (!chainCode) return fromSeed(privateKey);

  const fullKey = _objectSpread({}, XKEY_DEFAULTS, key);

  if (typeof fullKey.version !== 'number') {
    const {
      xpriv: {
        prefix
      }
    } = getHDSetting('xprv', network);
    fullKey.version = prefix;
  }

  return fullKey;
};
const fromSeed = (seed, network, version = 'xprv') => {
  const hash = sha512Hmac(SEED, seed);
  const {
    xpriv: {
      prefix
    }
  } = getHDSetting(version, network);
  if (typeof prefix !== 'number') throw new Error('');
  return fromPrivate({
    privateKey: hash.slice(0, 64),
    chainCode: hash.slice(64, 128),
    version: prefix
  }, network);
};
const fromHex = (keyHex, network) => {
  // Get the byte which tells us what type of key we're expecting
  const headerByte = parseInt(keyHex.slice(90, 92), 16);
  if (headerByte !== 0) throw new Error('Wrong private key header');
  return _objectSpread({
    privateKey: keyHex.slice(92, 156)
  }, dataFromHex(keyHex, network));
};
const fromString$1 = (xKey, network = 'main') => {
  const keyHex = getDecoder(network, xKey.slice(0, 4)).decode(xKey);
  return fromHex(keyHex, network);
};
const fromIndex = async (key, index, publicKey, hardended = false) => {
  try {
    const {
      depth,
      version,
      privateKey,
      chainCode
    } = key;
    if (index > MAX_INDEX) throw new Error('Index out of range.');
    if (depth >= MAX_DEPTH) throw new Error('Depth too high.');
    publicKey = publicKey || (await toPublic(privateKey, true)); // If the index is non-hardended, set 'tweakKey' to be the publicKey, otherwise the privateKey

    let tweakKey = index < HARDENED || hardended ? publicKey : `00${privateKey}`;
    tweakKey += index.toString(16).padStart(8, '0');
    const hash = sha512Hmac(chainCode, tweakKey);
    const childKey = await privateKeyTweakAdd(privateKey, hash.slice(0, 64));
    const parentFingerPrint = publicKey ? hash160(publicKey).slice(0, 8) : 0;
    return {
      privateKey: childKey,
      childNumber: index,
      chainCode: hash.slice(64, 128),
      depth: depth + 1,
      parentFingerPrint: parseInt(parentFingerPrint, 16),
      version
    };
  } catch (e) {
    if (!e.message.includes(TWEAK_OUT_OF_RANGE_ERROR)) throw e;
    return fromIndex(key, index + 1, publicKey);
  }
};
const fromPath = async (key, path, publicKey) => {
  if (typeof path === 'string') path = fromString(path);
  publicKey = publicKey || (await toPublic(key.privateKey, true));

  for (const index of path) {
    key = await fromIndex(key, index, publicKey);
    publicKey = await toPublic(key.privateKey, true);
  }

  return key;
};
const toHex = key => {
  const {
    privateKey
  } = key,
        rest = _objectWithoutProperties(key, ["privateKey"]);

  if (privateKey.length !== 64) throw new Error('Wrong private key length');
  return dataToHex(rest) + `00${privateKey}`;
};
const toString$1 = (hdKey, network = 'main') => getDecoder(network, hdKey.version).encode(toHex(hdKey));
const toPublic$1 = async (hdKey, network) => {
  const {
    privateKey,
    version
  } = hdKey,
        rest = _objectWithoutProperties(hdKey, ["privateKey", "version"]);

  const {
    xpub: {
      prefix
    }
  } = getHDSetting(hdKey.version, network);
  const publicKey = await toPublic(privateKey, true);
  return _objectSpread({
    publicKey,
    version: prefix
  }, rest);
};

var XPrivateKey = /*#__PURE__*/Object.freeze({
  fromPrivate: fromPrivate,
  fromSeed: fromSeed,
  fromHex: fromHex,
  fromString: fromString$1,
  fromIndex: fromIndex,
  fromPath: fromPath,
  toHex: toHex,
  toString: toString$1,
  toPublic: toPublic$1
});

const fromPublic = (key, network) => {
  const {
    publicKey,
    chainCode
  } = key,
        rest = _objectWithoutProperties(key, ["publicKey", "chainCode"]);

  if (!publicKey) throw new Error('Missing public key');
  if (!chainCode) throw new Error('Missing chainCode');

  const xKey = _objectSpread({}, XKEY_DEFAULTS, {
    publicKey,
    chainCode
  }, rest);

  if (!xKey.version) {
    const {
      xpub: {
        prefix
      }
    } = getHDSetting('xpub', network);
    xKey.version = prefix;
  }

  return xKey;
};
const fromHex$1 = (keyHex, network) => {
  // Get the byte which tells us what type of key we're expecting
  const headerByte = parseInt(keyHex.slice(90, 92), 16);
  if (headerByte !== 2 && headerByte !== 3) throw new Error('Wrong public key header');
  return _objectSpread({
    publicKey: keyHex.slice(90, 156)
  }, dataFromHex(keyHex, network));
};
const fromString$2 = (hdKey, network = 'main') => {
  const keyHex = getDecoder(network, hdKey.slice(0, 4)).decode(hdKey);
  return fromHex$1(keyHex, network);
};
const fromIndex$1 = async (key, index) => {
  try {
    const {
      depth,
      version,
      publicKey,
      chainCode
    } = key;
    if (index >= HARDENED) throw new Error('Cannot derive hardened index from a public key');
    if (index > MAX_INDEX) throw new Error('Index out of range.');
    if (depth >= MAX_DEPTH) throw new Error('Depth too high.');
    const tweakKey = publicKey + index.toString(16).padStart(8, '0');
    const hash = sha512Hmac(chainCode, tweakKey);
    const childKey = await publicKeyTweakAdd(publicKey, hash.slice(0, 64));
    const parentFingerPrint = hash160(publicKey).slice(0, 8);
    return {
      publicKey: childKey,
      childNumber: index,
      chainCode: hash.slice(64, 128),
      depth: depth + 1,
      parentFingerPrint: parseInt(parentFingerPrint, 16),
      version
    };
  } catch (e) {
    if (!e.message.includes(TWEAK_OUT_OF_RANGE_ERROR)) throw e;
    return fromIndex$1(key, index + 1);
  }
};
const fromPath$1 = async (key, path) => {
  if (typeof path === 'string') path = fromString(path, 'M');

  for (const index of path) {
    key = await fromIndex$1(key, index);
  }

  return key;
};
const toHex$1 = key => {
  const {
    publicKey
  } = key,
        rest = _objectWithoutProperties(key, ["publicKey"]);

  return dataToHex(rest) + publicKey;
};
const toString$2 = (hdKey, network = 'main') => getDecoder(network, hdKey.version).encode(toHex$1(hdKey));

var XPublicKey = /*#__PURE__*/Object.freeze({
  fromPublic: fromPublic,
  fromHex: fromHex$1,
  fromString: fromString$2,
  fromIndex: fromIndex$1,
  fromPath: fromPath$1,
  toHex: toHex$1,
  toString: toString$2
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
  PrivateKey,
  Networks: Networks$1,
  NetworkInfo
};
const HD = {
  XPrivateKey,
  XPublicKey,
  HDKey,
  Path
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

export { Core, HD, Utils };
//# sourceMappingURL=index.es.js.map
