import { assert } from 'chai';
import { describe, it, after, before } from 'mocha';
import { Buffer as Buffer$1 } from 'buffer';
import basex from 'base-x';
import babel from 'rollup-plugin-babel';
import flowEntry from 'rollup-plugin-flow-entry';
import json from 'rollup-plugin-json';
import multiEntry from 'rollup-plugin-multi-entry';

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
const ripemd160 = digest(hashjs.ripemd160);
const sha512Hmac = digestHmac(hashjs.hmac, hashjs.sha512);
const hash256 = data => sha256(sha256(data));
const hash160 = data => ripemd160(sha256(data));

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

var derive = {
	"private": [
		[
			"e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35",
			"873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508",
			0,
			true,
			"edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea",
			"47fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae6236141",
			2147483648
		],
		[
			"3c6cb8d0f6a264c91ea8b5030fadaa8e538b020f0a387421a12de9319dc93368",
			"2a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c19",
			2,
			true,
			"cbce0d719ecf7431d88e6a89fa1483e02e35092af60c042b1df2ff59fa424dca",
			"04466b9cc8e161e966409ca52986c584f07e9dc81f735db683c3ff6ec7b1503f",
			2147483650
		],
		[
			"abe74a98f6c7eabee0428f53798f0ab8aa1bd37873999041703c742f15ac7e1e",
			"f0909affaa7ee7abe5dd4e100598d4dc53cd709d5a5c2cac40e7412f232f7c9c",
			2147483647,
			true,
			"877c779ad9687164e9c2f4f0f4ff0340814392330693ce95a58fe18fd52e6e93",
			"be17a268474a6bb9c61e1d720cf6215e2a88c5406c4aee7b38547f585c9a37d9",
			4294967295
		],
		[
			"704addf544a06e5ee4bea37098463c23613da32020d604506da8c0518e1da4b7",
			"f366f48f1ea9f2d1d3fe958c95ca84ea18e4c4ddb9366c336c927eb246fb38cb",
			2147483646,
			true,
			"f1c7c871a54a804afe328b4c83a1c33b8e5ff48f5087273f04efa83b247d6a2d",
			"637807030d55d01f9a0cb3a7839515d796bd07706386a6eddf06cc29a65a0e29",
			4294967294
		],
		[
			"edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea",
			"47fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae6236141",
			1,
			false,
			"3c6cb8d0f6a264c91ea8b5030fadaa8e538b020f0a387421a12de9319dc93368",
			"2a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c19",
			1
		],
		[
			"cbce0d719ecf7431d88e6a89fa1483e02e35092af60c042b1df2ff59fa424dca",
			"04466b9cc8e161e966409ca52986c584f07e9dc81f735db683c3ff6ec7b1503f",
			2,
			false,
			"0f479245fb19a38a1954c5c7c0ebab2f9bdfd96a17563ef28a6a4b1a2a764ef4",
			"cfb71883f01676f587d023cc53a35bc7f88f724b1f8c2892ac1275ac822a3edd",
			2
		]
	],
	privateWithPublic: [
		[
			"4b03d6fc340455b363f51020ad3ecca4f0850280cf436c70c727923f6db46c3e",
			"60499f801b896d83179a4374aeb7822aaeaceaa0db1f85ee3e904c4defbd9689",
			0,
			false,
			"abe74a98f6c7eabee0428f53798f0ab8aa1bd37873999041703c742f15ac7e1e",
			"f0909affaa7ee7abe5dd4e100598d4dc53cd709d5a5c2cac40e7412f232f7c9c",
			0,
			"03cbcaa9c98c877a26977d00825c956a238e8dddfbd322cce4f74b0b5bd6ace4a7"
		],
		[
			"877c779ad9687164e9c2f4f0f4ff0340814392330693ce95a58fe18fd52e6e93",
			"be17a268474a6bb9c61e1d720cf6215e2a88c5406c4aee7b38547f585c9a37d9",
			1,
			false,
			"704addf544a06e5ee4bea37098463c23613da32020d604506da8c0518e1da4b7",
			"f366f48f1ea9f2d1d3fe958c95ca84ea18e4c4ddb9366c336c927eb246fb38cb",
			1,
			"03c01e7425647bdefa82b12d9bad5e3e6865bee0502694b94ca58b666abc0a5c3b"
		],
		[
			"f1c7c871a54a804afe328b4c83a1c33b8e5ff48f5087273f04efa83b247d6a2d",
			"637807030d55d01f9a0cb3a7839515d796bd07706386a6eddf06cc29a65a0e29",
			2,
			false,
			"bb7d39bdb83ecf58f2fd82b6d918341cbef428661ef01ab97c28a4842125ac23",
			"9452b549be8cea3ecb7a84bec10dcfd94afe4d129ebfd3b3cb58eedf394ed271",
			2,
			"02d2b36900396c9282fa14628566582f206a5dd0bcc8d5e892611806cafb0301f0"
		]
	],
	"public": [
		[
			"035a784662a4a20a65bf6aab9ae98a6c068a81c52e4b032c0fb5400c706cfccc56",
			"47fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae6236141",
			1,
			false,
			"03501e454bf00751f24b1b489aa925215d66af2234e3891c3b21a52bedb3cd711c",
			"2a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c19",
			1
		],
		[
			"0357bfe1e341d01c69fe5654309956cbea516822fba8a601743a012a7896ee8dc2",
			"04466b9cc8e161e966409ca52986c584f07e9dc81f735db683c3ff6ec7b1503f",
			2,
			false,
			"02e8445082a72f29b75ca48748a914df60622a609cacfce8ed0e35804560741d29",
			"cfb71883f01676f587d023cc53a35bc7f88f724b1f8c2892ac1275ac822a3edd",
			2
		],
		[
			"02e8445082a72f29b75ca48748a914df60622a609cacfce8ed0e35804560741d29",
			"cfb71883f01676f587d023cc53a35bc7f88f724b1f8c2892ac1275ac822a3edd",
			1000000000,
			false,
			"022a471424da5e657499d1ff51cb43c47481a03b1e77f951fe64cec9f5a48f7011",
			"c783e67b921d2beb8f6b389cc646d7263b4145701dadd2161548a8b078e65e9e",
			1000000000
		],
		[
			"03cbcaa9c98c877a26977d00825c956a238e8dddfbd322cce4f74b0b5bd6ace4a7",
			"60499f801b896d83179a4374aeb7822aaeaceaa0db1f85ee3e904c4defbd9689",
			0,
			false,
			"02fc9e5af0ac8d9b3cecfe2a888e2117ba3d089d8585886c9c826b6b22a98d12ea",
			"f0909affaa7ee7abe5dd4e100598d4dc53cd709d5a5c2cac40e7412f232f7c9c",
			0
		],
		[
			"03c01e7425647bdefa82b12d9bad5e3e6865bee0502694b94ca58b666abc0a5c3b",
			"be17a268474a6bb9c61e1d720cf6215e2a88c5406c4aee7b38547f585c9a37d9",
			1,
			false,
			"03a7d1d856deb74c508e05031f9895dab54626251b3806e16b4bd12e781a7df5b9",
			"f366f48f1ea9f2d1d3fe958c95ca84ea18e4c4ddb9366c336c927eb246fb38cb",
			1
		],
		[
			"02d2b36900396c9282fa14628566582f206a5dd0bcc8d5e892611806cafb0301f0",
			"637807030d55d01f9a0cb3a7839515d796bd07706386a6eddf06cc29a65a0e29",
			2,
			false,
			"024d902e1a2fc7a8755ab5b694c575fce742c48d9ff192e63df5193e4c7afe1f9c",
			"9452b549be8cea3ecb7a84bec10dcfd94afe4d129ebfd3b3cb58eedf394ed271",
			2
		]
	]
};
var extendedKey = {
	string: [
		[
			"xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8",
			"0339a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c2",
			76067358,
			0,
			0,
			0,
			"873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508"
		],
		[
			"xpub68Gmy5EdvgibQVfPdqkBBCHxA5htiqg55crXYuXoQRKfDBFA1WEjWgP6LHhwBZeNK1VTsfTFUHCdrfp1bgwQ9xv5ski8PX9rL2dZXvgGDnw",
			"035a784662a4a20a65bf6aab9ae98a6c068a81c52e4b032c0fb5400c706cfccc56",
			76067358,
			1,
			876747070,
			2147483648,
			"47fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae6236141"
		],
		[
			"xpub6ASuArnXKPbfEwhqN6e3mwBcDTgzisQN1wXN9BJcM47sSikHjJf3UFHKkNAWbWMiGj7Wf5uMash7SyYq527Hqck2AxYysAA7xmALppuCkwQ",
			"03501e454bf00751f24b1b489aa925215d66af2234e3891c3b21a52bedb3cd711c",
			76067358,
			2,
			1545328200,
			1,
			"2a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c19"
		],
		[
			"xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5",
			"0357bfe1e341d01c69fe5654309956cbea516822fba8a601743a012a7896ee8dc2",
			76067358,
			3,
			3203769081,
			2147483650,
			"04466b9cc8e161e966409ca52986c584f07e9dc81f735db683c3ff6ec7b1503f"
		],
		[
			"xpub6FHa3pjLCk84BayeJxFW2SP4XRrFd1JYnxeLeU8EqN3vDfZmbqBqaGJAyiLjTAwm6ZLRQUMv1ZACTj37sR62cfN7fe5JnJ7dh8zL4fiyLHV",
			"02e8445082a72f29b75ca48748a914df60622a609cacfce8ed0e35804560741d29",
			76067358,
			4,
			4001020172,
			2,
			"cfb71883f01676f587d023cc53a35bc7f88f724b1f8c2892ac1275ac822a3edd"
		],
		[
			"xpub6H1LXWLaKsWFhvm6RVpEL9P4KfRZSW7abD2ttkWP3SSQvnyA8FSVqNTEcYFgJS2UaFcxupHiYkro49S8yGasTvXEYBVPamhGW6cFJodrTHy",
			"022a471424da5e657499d1ff51cb43c47481a03b1e77f951fe64cec9f5a48f7011",
			76067358,
			5,
			3632322520,
			1000000000,
			"c783e67b921d2beb8f6b389cc646d7263b4145701dadd2161548a8b078e65e9e"
		],
		[
			"xpub661MyMwAqRbcFW31YEwpkMuc5THy2PSt5bDMsktWQcFF8syAmRUapSCGu8ED9W6oDMSgv6Zz8idoc4a6mr8BDzTJY47LJhkJ8UB7WEGuduB",
			"03cbcaa9c98c877a26977d00825c956a238e8dddfbd322cce4f74b0b5bd6ace4a7",
			76067358,
			0,
			0,
			0,
			"60499f801b896d83179a4374aeb7822aaeaceaa0db1f85ee3e904c4defbd9689"
		],
		[
			"xpub69H7F5d8KSRgmmdJg2KhpAK8SR3DjMwAdkxj3ZuxV27CprR9LgpeyGmXUbC6wb7ERfvrnKZjXoUmmDznezpbZb7ap6r1D3tgFxHmwMkQTPH",
			"02fc9e5af0ac8d9b3cecfe2a888e2117ba3d089d8585886c9c826b6b22a98d12ea",
			76067358,
			1,
			3172384485,
			0,
			"f0909affaa7ee7abe5dd4e100598d4dc53cd709d5a5c2cac40e7412f232f7c9c"
		],
		[
			"xpub6ASAVgeehLbnwdqV6UKMHVzgqAG8Gr6riv3Fxxpj8ksbH9ebxaEyBLZ85ySDhKiLDBrQSARLq1uNRts8RuJiHjaDMBU4Zn9h8LZNnBC5y4a",
			"03c01e7425647bdefa82b12d9bad5e3e6865bee0502694b94ca58b666abc0a5c3b",
			76067358,
			2,
			1516371854,
			4294967295,
			"be17a268474a6bb9c61e1d720cf6215e2a88c5406c4aee7b38547f585c9a37d9"
		],
		[
			"xpub6DF8uhdarytz3FWdA8TvFSvvAh8dP3283MY7p2V4SeE2wyWmG5mg5EwVvmdMVCQcoNJxGoWaU9DCWh89LojfZ537wTfunKau47EL2dhHKon",
			"03a7d1d856deb74c508e05031f9895dab54626251b3806e16b4bd12e781a7df5b9",
			76067358,
			3,
			3635104055,
			1,
			"f366f48f1ea9f2d1d3fe958c95ca84ea18e4c4ddb9366c336c927eb246fb38cb"
		],
		[
			"xpub6ERApfZwUNrhLCkDtcHTcxd75RbzS1ed54G1LkBUHQVHQKqhMkhgbmJbZRkrgZw4koxb5JaHWkY4ALHY2grBGRjaDMzQLcgJvLJuZZvRcEL",
			"02d2b36900396c9282fa14628566582f206a5dd0bcc8d5e892611806cafb0301f0",
			76067358,
			4,
			2017537594,
			4294967294,
			"637807030d55d01f9a0cb3a7839515d796bd07706386a6eddf06cc29a65a0e29"
		],
		[
			"xpub6FnCn6nSzZAw5Tw7cgR9bi15UV96gLZhjDstkXXxvCLsUXBGXPdSnLFbdpq8p9HmGsApME5hQTZ3emM2rnY5agb9rXpVGyy3bdW6EEgAtqt",
			"024d902e1a2fc7a8755ab5b694c575fce742c48d9ff192e63df5193e4c7afe1f9c",
			76067358,
			5,
			832899000,
			2,
			"9452b549be8cea3ecb7a84bec10dcfd94afe4d129ebfd3b3cb58eedf394ed271"
		],
		[
			"xpub661MyMwAqRbcFa4vkmBVnqhGEgWhewDgAv3xmFRny74D3sGHz6KTTbcskg2vZEMbEwxc4oaR435oczhSu4GdNwhwiVewcewU8A1Rr6HehAU",
			"02fce1b65c7470270fb89e5aa1dda253406b3370b948eae8a2a3539c4f25894283",
			76067358,
			0,
			0,
			0,
			"6745981482451e77f140db8328fa1c5891f88d52c8f2c99999adb42b51e8a2b9"
		],
		[
			"xpub693MU1BonjMa6Xxar2HQ9r3tRw3AA8yo7BBdvuSZF1D1eet32bVxGr9LYViWMtaLfQaa2StXeUmDG5VELFkU9pc3yfTzCk61WQJdR6ezj7a",
			"0324670e21612d0035d74563b25934ebfe0b1b1ea77ea18719029541aba107228a",
			76067358,
			1,
			2631072704,
			0,
			"699df6f3c02dd837b57614b6be231aecacc2bc38c29f8374ace546ce9abb01dc"
		],
		[
			"xpub693MU1BonjMa8MMoz9opJhrFejcXcGmhMP9gzySLsip4Dz1UrSLT4i2pAimHDyM2onW2H2L2HkbwrZqoizQLMoErXu8mPYxDf8tJUBAfBuT",
			"02e7eddf4cfa267c3b33a7e9387f28c55b6e806a79824c797b0f5acdfcdccc73e8",
			76067358,
			1,
			2631072704,
			1,
			"2024ffdedce7b87504431d8286cf58c7789c13d2b198e0e3b4568f3e58817566"
		],
		[
			"xpub693MU1BonjMa8MMoz9opJhrFejcXcGmhMP9gzySLsip4Dz1UrSLT4i2pAimHDyM2onW2H2L2HkbwrZqoizQLMoErXu8mPYxDf8tJUBAfBuT",
			"02e7eddf4cfa267c3b33a7e9387f28c55b6e806a79824c797b0f5acdfcdccc73e8",
			76067358,
			1,
			2631072704,
			1,
			"2024ffdedce7b87504431d8286cf58c7789c13d2b198e0e3b4568f3e58817566"
		],
		[
			"xpub693MU1BonjMaBynxewXEjDs4n2W9TFUheJ7FriPpa3zdQvQDwbvT9uGsEebvioAcYbtRUU7ge4yVgj8WDLrwtwuXKTWiieFoYX2B1JYUEfK",
			"031cd583c3ffb87477c539012859195f821e33b16435e8f3da0b40247056158618",
			76067358,
			1,
			2631072704,
			2,
			"8c903b9187357a03637c368f46f13ed21726b557ca2504895cb51c8960009ba1"
		],
		[
			"xpub6BZfReuexUYBTRwxFZyshBgF6SvpJ2GPQqFEXZ1ZrCUJrkcJ648DUdeRjx9QiNQxQvPcHYV3rGkvuExFQbVRS4kU5ynx4fAsWWhHgyPh1pP",
			"03268cd9af10d8b9d36f9c5da10038286174afc654c06f6aacfeea306b0c7a7637",
			76067358,
			2,
			4094041276,
			0,
			"850956c9144407f7363097881d824bb6bcd4b0bf7e3809cdb7e531dea9b2c931"
		],
		[
			"xpub6BZfReuexUYBVSENKiuKqKgf9KrMZh4rNoUZ4nqhemJeybd6Webqiu4zndBwa9UB4Jvr5jB5Bcgng6reXAKCuDiVm7zhzJ13BUDBiM8HidZ",
			"03641a1997a3538dd18036b941600b96e0c6229182c7089119894823324a5fff0c",
			76067358,
			2,
			4094041276,
			1,
			"4e68ec720ae8462780aaa52819e4e86c792916b518611e5de71f73b7a33a937a"
		],
		[
			"xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi",
			"e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35",
			76066276,
			0,
			0,
			0,
			"873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508"
		],
		[
			"xprv9uHRZZhk6KAJC1avXpDAp4MDc3sQKNxDiPvvkX8Br5ngLNv1TxvUxt4cV1rGL5hj6KCesnDYUhd7oWgT11eZG7XnxHrnYeSvkzY7d2bhkJ7",
			"edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea",
			76066276,
			1,
			876747070,
			2147483648,
			"47fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae6236141"
		],
		[
			"xprv9wTYmMFdV23N2TdNG573QoEsfRrWKQgWeibmLntzniatZvR9BmLnvSxqu53Kw1UmYPxLgboyZQaXwTCg8MSY3H2EU4pWcQDnRnrVA1xe8fs",
			"3c6cb8d0f6a264c91ea8b5030fadaa8e538b020f0a387421a12de9319dc93368",
			76066276,
			2,
			1545328200,
			1,
			"2a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c19"
		],
		[
			"xprv9z4pot5VBttmtdRTWfWQmoH1taj2axGVzFqSb8C9xaxKymcFzXBDptWmT7FwuEzG3ryjH4ktypQSAewRiNMjANTtpgP4mLTj34bhnZX7UiM",
			"cbce0d719ecf7431d88e6a89fa1483e02e35092af60c042b1df2ff59fa424dca",
			76066276,
			3,
			3203769081,
			2147483650,
			"04466b9cc8e161e966409ca52986c584f07e9dc81f735db683c3ff6ec7b1503f"
		],
		[
			"xprvA2JDeKCSNNZky6uBCviVfJSKyQ1mDYahRjijr5idH2WwLsEd4Hsb2Tyh8RfQMuPh7f7RtyzTtdrbdqqsunu5Mm3wDvUAKRHSC34sJ7in334",
			"0f479245fb19a38a1954c5c7c0ebab2f9bdfd96a17563ef28a6a4b1a2a764ef4",
			76066276,
			4,
			4001020172,
			2,
			"cfb71883f01676f587d023cc53a35bc7f88f724b1f8c2892ac1275ac822a3edd"
		],
		[
			"xprvA41z7zogVVwxVSgdKUHDy1SKmdb533PjDz7J6N6mV6uS3ze1ai8FHa8kmHScGpWmj4WggLyQjgPie1rFSruoUihUZREPSL39UNdE3BBDu76",
			"471b76e389e528d6de6d816857e012c5455051cad6660850e58372a6c3e6e7c8",
			76066276,
			5,
			3632322520,
			1000000000,
			"c783e67b921d2beb8f6b389cc646d7263b4145701dadd2161548a8b078e65e9e"
		],
		[
			"xprv9s21ZrQH143K31xYSDQpPDxsXRTUcvj2iNHm5NUtrGiGG5e2DtALGdso3pGz6ssrdK4PFmM8NSpSBHNqPqm55Qn3LqFtT2emdEXVYsCzC2U",
			"4b03d6fc340455b363f51020ad3ecca4f0850280cf436c70c727923f6db46c3e",
			76066276,
			0,
			0,
			0,
			"60499f801b896d83179a4374aeb7822aaeaceaa0db1f85ee3e904c4defbd9689"
		],
		[
			"xprv9vHkqa6EV4sPZHYqZznhT2NPtPCjKuDKGY38FBWLvgaDx45zo9WQRUT3dKYnjwih2yJD9mkrocEZXo1ex8G81dwSM1fwqWpWkeS3v86pgKt",
			"abe74a98f6c7eabee0428f53798f0ab8aa1bd37873999041703c742f15ac7e1e",
			76066276,
			1,
			3172384485,
			0,
			"f0909affaa7ee7abe5dd4e100598d4dc53cd709d5a5c2cac40e7412f232f7c9c"
		],
		[
			"xprv9wSp6B7kry3Vj9m1zSnLvN3xH8RdsPP1Mh7fAaR7aRLcQMKTR2vidYEeEg2mUCTAwCd6vnxVrcjfy2kRgVsFawNzmjuHc2YmYRmagcEPdU9",
			"877c779ad9687164e9c2f4f0f4ff0340814392330693ce95a58fe18fd52e6e93",
			76066276,
			2,
			1516371854,
			4294967295,
			"be17a268474a6bb9c61e1d720cf6215e2a88c5406c4aee7b38547f585c9a37d9"
		],
		[
			"xprv9zFnWC6h2cLgpmSA46vutJzBcfJ8yaJGg8cX1e5StJh45BBciYTRXSd25UEPVuesF9yog62tGAQtHjXajPPdbRCHuWS6T8XA2ECKADdw4Ef",
			"704addf544a06e5ee4bea37098463c23613da32020d604506da8c0518e1da4b7",
			76066276,
			3,
			3635104055,
			1,
			"f366f48f1ea9f2d1d3fe958c95ca84ea18e4c4ddb9366c336c927eb246fb38cb"
		],
		[
			"xprvA1RpRA33e1JQ7ifknakTFpgNXPmW2YvmhqLQYMmrj4xJXXWYpDPS3xz7iAxn8L39njGVyuoseXzU6rcxFLJ8HFsTjSyQbLYnMpCqE2VbFWc",
			"f1c7c871a54a804afe328b4c83a1c33b8e5ff48f5087273f04efa83b247d6a2d",
			76066276,
			4,
			2017537594,
			4294967294,
			"637807030d55d01f9a0cb3a7839515d796bd07706386a6eddf06cc29a65a0e29"
		],
		[
			"xprvA2nrNbFZABcdryreWet9Ea4LvTJcGsqrMzxHx98MMrotbir7yrKCEXw7nadnHM8Dq38EGfSh6dqA9QWTyefMLEcBYJUuekgW4BYPJcr9E7j",
			"bb7d39bdb83ecf58f2fd82b6d918341cbef428661ef01ab97c28a4842125ac23",
			76066276,
			5,
			832899000,
			2,
			"9452b549be8cea3ecb7a84bec10dcfd94afe4d129ebfd3b3cb58eedf394ed271"
		],
		[
			"xprv9s21ZrQH143K35zTejeVRhkXgegDFUVpoh8Mxs2BQmXEB4w9SZ1CuoJPuQ2KGQrS1ZF3Pk7V7KWHn7FqR2JbAE9Bh8PURnrFnrmArj4kxos",
			"7bd083869bd02e57786d119a81d406ac1524a765470acee90834c60f841e6236",
			76066276,
			0,
			0,
			0,
			"6745981482451e77f140db8328fa1c5891f88d52c8f2c99999adb42b51e8a2b9"
		],
		[
			"xprv9v414VeuxMoGt3t7jzkPni79suCfkgFwjxG38X2wgfg2mrYtV4Bhj3prhDDCcBiJrz9n4xLYoDtBFRuQmreVLKzmiZAqvbGpx5q4yHfzfah",
			"622c81feac4a3bf2d87578edeb3384b8b024184fbc515626c897ea452e7c8f96",
			76066276,
			1,
			2631072704,
			0,
			"699df6f3c02dd837b57614b6be231aecacc2bc38c29f8374ace546ce9abb01dc"
		],
		[
			"xprv9v414VeuxMoGusHLt8GowZuX6hn3Cp3qzAE6Cb2jKPH5MBgLJu2CWuiLKTdWV8WoNFYvpCcBfbpWfeyEQ8zytZW5qy39roTcugBGUkeAvCc",
			"da4b3947e054576f0f353d1a7f4eedd7dbca242a83cba29d3962a2ffd4e30ae5",
			76066276,
			1,
			2631072704,
			1,
			"2024ffdedce7b87504431d8286cf58c7789c13d2b198e0e3b4568f3e58817566"
		],
		[
			"xprv9v414VeuxMoGyViVYuzEN5vLDzff3nkrH5Bf4KzD1iTeY855Q4cCc6xPPNoc6MJcsqqRQiGqR977cEEGK2mhVp7ALKHqY1icEw3Q9UmfQ1v",
			"b7aaa6c8f5b4013e7b1755ae877b9fad530e9b2e86f68cec7420a6cea38e81b0",
			76066276,
			1,
			2631072704,
			2,
			"8c903b9187357a03637c368f46f13ed21726b557ca2504895cb51c8960009ba1"
		],
		[
			"xprv9xaK29Nm86ytEwsV9YSsL3jWYR6KtZYY3cKdjAbxHrwKyxH9YWoxvqKwtgQmExGpxAEDrwB4WK9YG1iukth3XiSgsxXLK1W3NB31gLee8fi",
			"c9ba3ede6230e80cb243e9b20a1bd4846165ea312fde7eafe56fc52dcd583899",
			76066276,
			2,
			4094041276,
			0,
			"850956c9144407f7363097881d824bb6bcd4b0bf7e3809cdb7e531dea9b2c931"
		],
		[
			"xprv9xaK29Nm86ytGx9uDhNKUBjvbJ1sAEM11aYxGQS66Rmg6oHwy7HbB6kWwMHvukzdbPpGhfNXhZgePWFHm1DCh5PACPFywJJKr1AnUJTLjUc",
			"f2039f55285a430162c720126d26e96ec43e5b680a0d71cbabaa28dbea091f43",
			76066276,
			2,
			4094041276,
			1,
			"4e68ec720ae8462780aaa52819e4e86c792916b518611e5de71f73b7a33a937a"
		],
		[
			"xprv9s21ZrQH143K3ckY9DgU79uMTJkQRLdbCCVDh81SnxTgPzLLGax6uHeBULTtaEtcAvKjXfT7ZWtHzKjTpujMkUd9dDb8msDeAfnJxrgAYhr",
			"00000055378cf5fafb56c711c674143f9b0ee82ab0ba2924f19b64f5ae7cdbfd",
			76066276,
			0,
			0,
			0,
			"9c8a5c863e5941f3d99453e6ba66b328bb17cf0b8dec89ed4fc5ace397a1c089"
		]
	]
};
var hdKey = {
	fromSeed: [
		[
			"source mutual capable tissue tide pudding build cricket joy problem next purity oxygen ugly upset olive shield good merry cram school short benefit disagree",
			"2fe98754525f698edcb6088bb2e992c32004acef0f3905a6fb0225971dea677860805bed284ee7e5f3cdf1bee691d04201ea11290d3091b81ceffa6fc39be5f7",
			"xprv9s21ZrQH143K2n9Xc76gUieX7Nk6aj2v8YusPEPnuoZ6DFmRwkjox3u4istSoy4sS1KWj5QNPxQ8gokjxxX3ziSD5hMjdtGq23HLHWLcejz"
		],
		[
			"wisdom play manual rigid tip civil much output much hawk aerobic erode kick enable charge",
			"c651a27f6f4f5366999aa22271695f25a3fc28f979b138df471b869ab395961c8ba5347d43a52afbf331285add025b5c7d3eaea7ab883aba6f8b6c04f5f0dba0",
			"xprv9s21ZrQH143K4bZJyL1HHQ1NMwDJsGXh3XqULBnRD1U9PwocsjfvseBZGcpw4vEAMhtAdcxbKqtwr3jRUgmtLXsjfMFNSjtY6VGUkHE7vQ1"
		],
		[
			"window raven save select member trigger loud jelly accident vessel such time",
			"16d46953c56010aee578d33dc9326075cf79e13c9492f2bd277334414b8ad19e305892e8a6e230a4e40bab8b39be1d53055b23b4bebe8f6a521b30c821764332",
			"xprv9s21ZrQH143K2cp26VXyaSVzD7aSbxMeRFWQpFknyu4fvPNmqHf72r2v14qb3qpPjHSQRbC6PV8jfvHn1t32LfFL23HtFBz7WtdoJqKw1Ae"
		],
		[
			"strong intact economy injury train garage woman unique wealth profit nasty enter robot egg decorate gain claim local brush disorder hunt staff village jelly",
			"c094a23d338f64adde79314ecaa237cff218c8463bd10d61cc54928f2c636240319c17d3464c7104e3a7694fabfdcf84d37b9b1d97700772963777f7ff593c6a",
			"xprv9s21ZrQH143K4a7fTMX2aXqimYEAKvDB6oJSeMf4hck5tbKTV2L6HJHMDcNoFn5YNzEVV6kU9gjh9TgGEET5vxYEjxjRUCBowJFZAWRRAYZ"
		]
	],
	fromString: [
		[
			"xprv9s21ZrQH143K2n9Xc76gUieX7Nk6aj2v8YusPEPnuoZ6DFmRwkjox3u4istSoy4sS1KWj5QNPxQ8gokjxxX3ziSD5hMjdtGq23HLHWLcejz",
			"m",
			false,
			"m"
		],
		[
			"xprv9s21ZrQH143K2n9Xc76gUieX7Nk6aj2v8YusPEPnuoZ6DFmRwkjox3u4istSoy4sS1KWj5QNPxQ8gokjxxX3ziSD5hMjdtGq23HLHWLcejz",
			"",
			false,
			"m"
		],
		[
			"xprv9yuCvdvQ5yaRubkg5AXB5ffBWVTjzyPdk6DZWPhjgTHRe8hrt99WKPVYSwg5yi652Jp46W1TadMMwxjBoqFs31gcSGQmo1VYc1CbStCmeZC",
			"m/44'/0'/0'",
			true,
			"m/44'/0'/0'"
		],
		[
			"xpub6CtZL9THvM8j85q9BC4BSobv4XJEQS7V7K9AJn7MEnpQWw31RgTksBp2JBsQib9AR1XjFAjnRgbL7jGFyJzNTdk6VATYfVNdSQEC988jXQ6",
			"m/44'/0'/0'",
			true,
			"m/44'/0'/0'"
		],
		[
			"xprvA1DL6AqusHvgE9Anktxvm2vBStKKT6EmEX32vDxaJipiEDccBnvsZpoVyTBQQDzVX727icM3CKy2oPdFZj84n8EsE8CWYaAqxLmNNMPsKsc",
			"m/44'/0'/0'/0",
			false,
			"m/44'/0'/0'/0"
		],
		[
			"xpub6ECgVgNohfUySdFFrvVw8Aruzv9orYxcbjxdicNBs4Mh71wkjLF87d7ypmLzieGuji5hQ9pNPckjH6YV2mDsJp4riUopwqWaQN8gBKryoTw",
			"m/44'/0'/0'/0",
			false,
			"m/44'/0'/0'/0"
		],
		[
			"xprv9yuCvdvQ5yaRubkg5AXB5ffBWVTjzyPdk6DZWPhjgTHRe8hrt99WKPVYSwg5yi652Jp46W1TadMMwxjBoqFs31gcSGQmo1VYc1CbStCmeZC",
			"m/44'/0'",
			true,
			"m/44'/0'/0'"
		],
		[
			"xpub6CtZL9THvM8j85q9BC4BSobv4XJEQS7V7K9AJn7MEnpQWw31RgTksBp2JBsQib9AR1XjFAjnRgbL7jGFyJzNTdk6VATYfVNdSQEC988jXQ6",
			"m/44'/0'",
			true,
			"m/44'/0'/0'"
		],
		[
			"xprvA1DL6AqusHvgE9Anktxvm2vBStKKT6EmEX32vDxaJipiEDccBnvsZpoVyTBQQDzVX727icM3CKy2oPdFZj84n8EsE8CWYaAqxLmNNMPsKsc",
			"m/44'/0'/0'",
			false,
			"m/44'/0'/0'/0"
		],
		[
			"xpub6ECgVgNohfUySdFFrvVw8Aruzv9orYxcbjxdicNBs4Mh71wkjLF87d7ypmLzieGuji5hQ9pNPckjH6YV2mDsJp4riUopwqWaQN8gBKryoTw",
			"m/44'/0'/0'",
			false,
			"m/44'/0'/0'/0"
		],
		[
			"xprv9yuCvdvQ5yaRubkg5AXB5ffBWVTjzyPdk6DZWPhjgTHRe8hrt99WKPVYSwg5yi652Jp46W1TadMMwxjBoqFs31gcSGQmo1VYc1CbStCmeZC",
			"44'/0'",
			true,
			"m/44'/0'/0'"
		],
		[
			"xpub6CtZL9THvM8j85q9BC4BSobv4XJEQS7V7K9AJn7MEnpQWw31RgTksBp2JBsQib9AR1XjFAjnRgbL7jGFyJzNTdk6VATYfVNdSQEC988jXQ6",
			"44'/0'",
			true,
			"m/44'/0'/0'"
		],
		[
			"xprvA1DL6AqusHvgE9Anktxvm2vBStKKT6EmEX32vDxaJipiEDccBnvsZpoVyTBQQDzVX727icM3CKy2oPdFZj84n8EsE8CWYaAqxLmNNMPsKsc",
			"44'/0'/0'",
			false,
			"m/44'/0'/0'/0"
		],
		[
			"xpub6ECgVgNohfUySdFFrvVw8Aruzv9orYxcbjxdicNBs4Mh71wkjLF87d7ypmLzieGuji5hQ9pNPckjH6YV2mDsJp4riUopwqWaQN8gBKryoTw",
			"44'/0'/0'",
			false,
			"m/44'/0'/0'/0"
		]
	],
	fromStringErrors: [
		[
			"xprv9yuCvdvQ5yaRubkg5AXB5ffBWVTjzyPdk6DZWPhjgTHRe8hrt99WKPVYSwg5yi652Jp46W1TadMMwxjBoqFs31gcSGQmo1VYc1CbStCmeZC",
			"m/44'",
			"Wrong path depth for key"
		],
		[
			"xpub6CtZL9THvM8j85q9BC4BSobv4XJEQS7V7K9AJn7MEnpQWw31RgTksBp2JBsQib9AR1XjFAjnRgbL7jGFyJzNTdk6VATYfVNdSQEC988jXQ6",
			"m/44'/0'/15'",
			"Wrong index for key"
		]
	],
	fromPath: [
		[
			"xprv9s21ZrQH143K2n9Xc76gUieX7Nk6aj2v8YusPEPnuoZ6DFmRwkjox3u4istSoy4sS1KWj5QNPxQ8gokjxxX3ziSD5hMjdtGq23HLHWLcejz",
			"m/44'/0'/0'/0",
			[
				"xprv9vguuwteA6vSmZqdaGAUdXHRGFfM5yW4Tssi7hAqXa9A9zgfmj12rt6f8FwWCPWY9ZWfhrRBeVRVvn1beRNH4RAW9EXE3CDYssEzNEdmpKT",
				"xpub69gGKTRXzUUjz3v6gHhUzfE9pHVqVSDuq6oJv5aT5ug92o1pKGKHQgR8yWzCAL8vAgjss9TSdmVpVGSsGVrJB8zxLBBgNVzWuVRzqgvUAAL"
			],
			[
				"xprv9wQpzWSWCEfUx8UoB2pVBrRsE8aBhZu56fuooKRjVRrehfmDAgpX3fRUjNNmkqhCUEg5wK7sTTpa5p27oT8Gq9gAma2tKqQ4u3ea6ZgMpZy",
				"xpub6AQBQ1yQ2cDnAcZGH4MVYzNbnAQg72cvTtqQbhqM3mPdaU6MiE8mbTjxafxTmUWkywyxPKtyx7Ue23VwZbGBWuR3UuRGRYtxNXF3jJEbWzc"
			],
			[
				"xprv9yuCvdvQ5yaRubkg5AXB5ffBWVTjzyPdk6DZWPhjgTHRe8hrt99WKPVYSwg5yi652Jp46W1TadMMwxjBoqFs31gcSGQmo1VYc1CbStCmeZC",
				"xpub6CtZL9THvM8j85q9BC4BSobv4XJEQS7V7K9AJn7MEnpQWw31RgTksBp2JBsQib9AR1XjFAjnRgbL7jGFyJzNTdk6VATYfVNdSQEC988jXQ6"
			],
			[
				"xprvA1DL6AqusHvgE9Anktxvm2vBStKKT6EmEX32vDxaJipiEDccBnvsZpoVyTBQQDzVX727icM3CKy2oPdFZj84n8EsE8CWYaAqxLmNNMPsKsc",
				"xpub6ECgVgNohfUySdFFrvVw8Aruzv9orYxcbjxdicNBs4Mh71wkjLF87d7ypmLzieGuji5hQ9pNPckjH6YV2mDsJp4riUopwqWaQN8gBKryoTw"
			]
		],
		[
			"xprv9s21ZrQH143K2n9Xc76gUieX7Nk6aj2v8YusPEPnuoZ6DFmRwkjox3u4istSoy4sS1KWj5QNPxQ8gokjxxX3ziSD5hMjdtGq23HLHWLcejz",
			"m/84'/1'/185'/1",
			[
				"xprv9vguuwteA6vUWoZAFSiL3CAcLffgkas1tJRfRdgmSaw2icphY3at1stDg37oLyNtPvwjMbUDhikbLCFHdY5aJkiPwGt4kT5SqsNs2zrwm16",
				"xpub69gGKTRXzUUmjHddMUFLQL7LthWBA3asFXMGE26NzvU1bR9r5au8ZgChXKBUSH8H11FXAgSTUoddgAZQtYMsDME5WMrhGENksCKQbdjfAGb"
			],
			[
				"xprv9xLHoCniEAbZAkBsRZNiLg3gNhPWVjtyTPys7tVJqchSAB3nUu92Fc1qxrx4shwA4zc4rtKVPaQjpwhvJNPmeHJQmLcX7ft5sKaTkeckMaQ",
				"xpub6BKeCiKc4Y9rPEGLXauihozQvjDzuCcppcuTvGtvPxER2yNw2STGoQLKp8ciywikpwe8c3LHHQ4sqCvWXpFexXR2FiWxsVvqqQL4Jc2fC6b"
			],
			[
				"xprv9zKdPY9HJw311WjSwBmShQLD5trLkLBWzGdwHdPVe5NopkN5bkBmMt7ms5Cr5t3ZHKCELf6tRewPwQQCRfDdx1o9Mz3KfsaQMxDrAjCTumo",
				"xpub6DJyo3gB9JbJDzov3DJT4YGwdvgq9nuNMVZY61o7CQunhYhE9HW1ugSFiMdojmKCG6Fj4Lna9MAwxQwkMo8FmJnKaDmp6CDf4Z1tobVK6us"
			],
			[
				"xprvA1hksCwuMJ2ULJoHDbzr4DYnBvstReGefUgQYNHMfsYw6PXMt4Bauv7392Q3zD7p9zaUAu1caDjMRBAvDVFfXMTW1visys4sfp6Zi6Udj4X",
				"xpub6Eh7GiUoBfamYnskKdXrRMVWjxiNq6zW2hc1LkgyED5uyBrWRbVqTiRWzKAHDnQBKzyNHVQNMxBZdmWFU525AZy4GKVtZrcGb1VTT5w1GqR"
			]
		],
		[
			"xprv9s21ZrQH143K2n9Xc76gUieX7Nk6aj2v8YusPEPnuoZ6DFmRwkjox3u4istSoy4sS1KWj5QNPxQ8gokjxxX3ziSD5hMjdtGq23HLHWLcejz",
			"m/32/0/1",
			[
				"xprv9vguuwtVpSPU4AUho4e6CS7Fp7fDPLbATucyLYbfu5YtaoyNLp2zpCfGExyn1uu2NdRu79wrpGfrzgzHZ7eFyeCGUpw5VWA1JYGAmhUEbks",
				"xpub69gGKTRPeowmGeZAu6B6Za3zN9VhnoK1q8Ya8w1HTR5sTcJWtMMFMzyk6FibQRL9beH5WENvyF7Y82ShSWjH57LxJd2tenvwjNLdxw1udLo"
			],
			[
				"xprv9ws3xD2M5ru2pczkjK4LCguqCAjbC4Bs3NQATogSE1HKpXofJmRyPPWR51PyBGZua4rxye7ZThPkjHBWSS39frij9d5QUtsewmSWLuSrTxJ",
				"xpub6ArQMiZEvETL375DqLbLZprZkCa5bWuiQbKmGC63nLpJhL8orJkDwBptvKPFtJc3kzbgAT1hUFMqcfKmFvnECyrFyyT38Ey8Ff6J2WGAw35"
			],
			[
				"xprv9zUN13hp6Nn62NnB7bkw8MGtPhbjWKjWGEyhuLzkchEWV6mXJdXiWw628kA2f6yCyPEPC6crnHPXmxtUiZpGqF4tc3eyf1NBHs2ee3dRGHu",
				"xpub6DTiQZEhvkLPErreDdHwVVDcwjSDunTMdTuJhjQNB2mVMu6frAqy4jQVz1AMqsXhcrym9wSw34CjVWmRdZSYtLKXx5ecspfeHWpk728zyyj"
			]
		]
	]
};
var fixtures = {
	derive: derive,
	extendedKey: extendedKey,
	hdKey: hdKey
};

const deriveFixtures = fixtures.derive;
describe('Testing Key derivation', function () {
  deriveFixtures.private.forEach(test => {
    it(`Deriving private key without public key ${test[0]} for index ${test[2]}`, async function () {
      const privateKey = test[0];
      const chainCode = test[1];
      const index = test[2];
      const hardened = test[3];
      const expectedChildKey = {
        privateKey: test[4],
        chainCode: test[5],
        childIndex: test[6]
      };
      const childKey = await derivePrivate(privateKey, index, chainCode, hardened);
      assert.deepEqual(childKey, expectedChildKey);
    });
  });
  deriveFixtures.privateWithPublic.forEach(test => {
    it(`Deriving private key with public key ${test[0]} for index ${test[2]}`, async function () {
      const privateKey = test[0];
      const chainCode = test[1];
      const index = test[2];
      const hardened = test[3];
      const expectedChildKey = {
        privateKey: test[4],
        chainCode: test[5],
        childIndex: test[6]
      };
      const publicKey = test[7];
      const childKey = await derivePrivate(privateKey, index, chainCode, hardened, publicKey);
      assert.deepEqual(childKey, expectedChildKey);
    });
  });
  deriveFixtures.public.forEach(test => {
    it(`Deriving public key ${test[0]} for index ${test[2]}`, async function () {
      const publicKey = test[0];
      const chainCode = test[1];
      const index = test[2];
      const hardened = test[3];
      const expectedChildKey = {
        publicKey: test[4],
        chainCode: test[5],
        childIndex: test[6]
      };
      const childKey = await derivePublic(publicKey, index, chainCode, hardened);
      assert.deepEqual(childKey, expectedChildKey);
    });
  });
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
  }
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

const XKeyFixtures = fixtures.extendedKey;
const network = 'main';
describe(`Testing Extended Key functions`, function () {
  XKeyFixtures.string.forEach(test => {
    const base58Key = test[0];
    let xkey = {
      version: test[2],
      depth: test[3],
      parentFingerPrint: test[4],
      childIndex: test[5],
      chainCode: test[6]
    };
    if (test[1].length === 64) xkey = _objectSpread({}, xkey, {
      privateKey: test[1]
    });
    if (test[1].length === 66) xkey = _objectSpread({}, xkey, {
      publicKey: test[1]
    });
    it(`Extended key from string: ${test[0]}`, function () {
      const resultedXkey = fromString(base58Key, network);
      assert.deepEqual(resultedXkey, xkey);
    });
    it(`Extended key to string: ${test[1]}`, function () {
      if (!xkey.publicKey) xkey = _objectSpread({}, xkey, {
        publicKey: `02${test[1]}`
      });
      const resultedBase58Key = toString(xkey, network);
      assert.equal(resultedBase58Key, base58Key);
    });
  });
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

const HDKeyFixtures = fixtures.hdKey;
const network$1 = 'main';
describe('Testing HD Key', function () {
  HDKeyFixtures.fromSeed.forEach(test => {
    it(`Creating HD key from phrase ${test[0]}`, async function () {
      const childKey = await fromSeed$1(test[1]);
      const xkey = toString$1(childKey);
      assert.deepEqual(xkey, test[2]);
    });
  });
  HDKeyFixtures.fromString.forEach(test => {
    it(`Creating HD key from xkey ${test[0]} with path ${test[1]}`, function () {
      const opts = {};
      if (test[1]) opts.path = test[1].split('/');
      const hdKey$$1 = fromString$1(test[0], opts);
      assert.equal(hdKey$$1.hardened, test[2]);
      assert.equal(hdKey$$1.path.join('/'), test[3]);
    });
  });
  HDKeyFixtures.fromStringErrors.forEach(test => {
    it(`Error on Creating HD key with error type ${test[2]}`, function () {
      try {
        fromString$1(test[0], {
          path: test[1].split('/')
        });
      } catch (e) {
        assert.equal(e.message, test[2]);
      }
    });
  });
  HDKeyFixtures.fromPath.forEach(test => {
    it(`Deriving HD key from xkey ${test[0]} with path ${test[1]}`, async function () {
      const path = test[1].split('/');
      const parentKey = fromString$1(test[0]);
      let hdKey$$1 = await fromPath(parentKey, {
        path
      });
      path.shift();
      let testIndex = 2;

      while (path.length) {
        const index = path.shift();
        hdKey$$1 = hdKey$$1.children[index];
        const xprivkey = toString$1(hdKey$$1);
        const xpubkey = toString$1(hdKey$$1, network$1, true);
        assert.equal(xprivkey, test[testIndex][0], 'xpriv');
        assert.equal(xpubkey, test[testIndex][1], 'xpub');
        testIndex++;
      }
    });
  });
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

var createPaths$1 = [
	[
		"xprv9s21ZrQH143K2n9Xc76gUieX7Nk6aj2v8YusPEPnuoZ6DFmRwkjox3u4istSoy4sS1KWj5QNPxQ8gokjxxX3ziSD5hMjdtGq23HLHWLcejz",
		null,
		[
			32
		],
		"xprv9wu4xj9HBf23eLtY9AvoQSth3vA4TpE4a4SUBXHD3yK62ikgaRvVH8pMq2SzRVVG63GtPgjTKZY1CYmHkgyucgjeMKGBANpMksxDTPWtqcU",
		"xpub6AtRNEgB22aLrpy1FCTomaqRbwzYsGwuwHN4yugpcJr4uX5q7yEjpw8qgKEnAwvpsaMzgHgGWpQSi49pLAkSPG7KVsKgfyLAZiEsdcjtqeV"
	],
	[
		"xprv9s21ZrQH143K2n9Xc76gUieX7Nk6aj2v8YusPEPnuoZ6DFmRwkjox3u4istSoy4sS1KWj5QNPxQ8gokjxxX3ziSD5hMjdtGq23HLHWLcejz",
		[
			0,
			0
		],
		[
			44
		],
		"xprvA1DL6AqusHvgE9Anktxvm2vBStKKT6EmEX32vDxaJipiEDccBnvsZpoVyTBQQDzVX727icM3CKy2oPdFZj84n8EsE8CWYaAqxLmNNMPsKsc",
		"xpub6ECgVgNohfUySdFFrvVw8Aruzv9orYxcbjxdicNBs4Mh71wkjLF87d7ypmLzieGuji5hQ9pNPckjH6YV2mDsJp4riUopwqWaQN8gBKryoTw",
		"xprvA1DL6AqusHvgFJq9C2bEmX2bmqu3KEYXtdfEnnmdVe7Bwa3zZpmC4oMo5fzrDn2zuBSArfP18TRMoxdS3aVx8dmmMwykEyRj89kQXBHfTpP",
		"xpub6ECgVgNohfUyTnucJ48F8eyLKsjXihGPFraqbBBF3yeApNP97N5ScbgGvzdgv9Xgeiut2uBEgsP5SnxpJ5FbVSR76N2BhUJc8vqZwMwoWg8"
	],
	[
		"xprv9s21ZrQH143K2n9Xc76gUieX7Nk6aj2v8YusPEPnuoZ6DFmRwkjox3u4istSoy4sS1KWj5QNPxQ8gokjxxX3ziSD5hMjdtGq23HLHWLcejz",
		null,
		[
			44,
			84
		],
		"xprvA1DL6AqusHvgE9Anktxvm2vBStKKT6EmEX32vDxaJipiEDccBnvsZpoVyTBQQDzVX727icM3CKy2oPdFZj84n8EsE8CWYaAqxLmNNMPsKsc",
		"xpub6ECgVgNohfUySdFFrvVw8Aruzv9orYxcbjxdicNBs4Mh71wkjLF87d7ypmLzieGuji5hQ9pNPckjH6YV2mDsJp4riUopwqWaQN8gBKryoTw",
		"xprvA1DL6AqusHvgFJq9C2bEmX2bmqu3KEYXtdfEnnmdVe7Bwa3zZpmC4oMo5fzrDn2zuBSArfP18TRMoxdS3aVx8dmmMwykEyRj89kQXBHfTpP",
		"xpub6ECgVgNohfUyTnucJ48F8eyLKsjXihGPFraqbBBF3yeApNP97N5ScbgGvzdgv9Xgeiut2uBEgsP5SnxpJ5FbVSR76N2BhUJc8vqZwMwoWg8",
		"xprvA1EHkuHt6M4kCWHv7s6eQCXxCzcusYp4VatT3R6ALQX1vwTnBJRbbRcWn695uBN7LoKyhLfjZ8kE7crcGcoJokPRFmCVKvKhHRo2AGvoty6",
		"xpub6EDeAQpmvid3QzNPDtdemLUgm2TQH1Xurop3qoVmtk3zojnviqjr9DvzdQL5A1hBFVcwk6Wue4BPKnVdLL8A79szdBAPfKxSyvGKtAXbPVp",
		"xprvA1EHkuHt6M4kD5ezVbQuLP4jMyAC3rWVwC99mooXR5GezAoR2Xud2LwKUCvvPgB5oQG8LLKBKTmgf5cbqPWEA2vVzzMKJ4N7zu2MhEfunfz",
		"xpub6EDeAQpmvid3RZjTbcwuhX1TuzzgTKEMJR4kaCD8yQodry8Za5Dsa9FoKUP2Vno7Cz3B6nYZKVgVBsC26BzdociK7NBygRXNS9QYiKLDtpY"
	],
	[
		"xprv9s21ZrQH143K2n9Xc76gUieX7Nk6aj2v8YusPEPnuoZ6DFmRwkjox3u4istSoy4sS1KWj5QNPxQ8gokjxxX3ziSD5hMjdtGq23HLHWLcejz",
		[
			0,
			0
		],
		null,
		"xprvA1EHkuHt6M4kCWHv7s6eQCXxCzcusYp4VatT3R6ALQX1vwTnBJRbbRcWn695uBN7LoKyhLfjZ8kE7crcGcoJokPRFmCVKvKhHRo2AGvoty6",
		"xpub6EDeAQpmvid3QzNPDtdemLUgm2TQH1Xurop3qoVmtk3zojnviqjr9DvzdQL5A1hBFVcwk6Wue4BPKnVdLL8A79szdBAPfKxSyvGKtAXbPVp",
		"xprvA1EHkuHt6M4kD5ezVbQuLP4jMyAC3rWVwC99mooXR5GezAoR2Xud2LwKUCvvPgB5oQG8LLKBKTmgf5cbqPWEA2vVzzMKJ4N7zu2MhEfunfz",
		"xpub6EDeAQpmvid3RZjTbcwuhX1TuzzgTKEMJR4kaCD8yQodry8Za5Dsa9FoKUP2Vno7Cz3B6nYZKVgVBsC26BzdociK7NBygRXNS9QYiKLDtpY",
		"xprv9zbeVbpHXViq72GPp7ETLUdZjzySvDTTNFLjGAveV6ax4xKCnYqgp9rnv7cp7WHzy8h4YxxGs6hEZcb8khT7RVXCmyrpD3VPBZ5Y1DnhQHR",
		"xpub6Dazu7MBMsH8KWLrv8mThcaJJ2owKgBJjUGL4ZLG3S7vwkeML69wMxBGmMqU5UUdGyy92iU5FxkdFfBTF43fTv1cn4MFxo9Pz5pSWqTAsTT",
		"xprv9zbeVbpHXViq9eYADPQB2oaHM5tdoLsuKKCsKApTAUxv3daV2Z9dEW75B8J1djxGFD1Zha2WmVVXmsur8eH8giywMAHq8TQByX6cn3v7iGP",
		"xpub6Dazu7MBMsH8N8cdKQwBPwX1u7j8CobkgY8U7ZE4ipVtvRuda6TsnJRZ2Rn3rtPrnPHumU3dkqYKv3SnZFG5osEFJE2r7SLFFDm65YoNKQC",
		"xprvA1DL6AqusHvgE9Anktxvm2vBStKKT6EmEX32vDxaJipiEDccBnvsZpoVyTBQQDzVX727icM3CKy2oPdFZj84n8EsE8CWYaAqxLmNNMPsKsc",
		"xpub6ECgVgNohfUySdFFrvVw8Aruzv9orYxcbjxdicNBs4Mh71wkjLF87d7ypmLzieGuji5hQ9pNPckjH6YV2mDsJp4riUopwqWaQN8gBKryoTw",
		"xprvA1DL6AqusHvgFJq9C2bEmX2bmqu3KEYXtdfEnnmdVe7Bwa3zZpmC4oMo5fzrDn2zuBSArfP18TRMoxdS3aVx8dmmMwykEyRj89kQXBHfTpP",
		"xpub6ECgVgNohfUyTnucJ48F8eyLKsjXihGPFraqbBBF3yeApNP97N5ScbgGvzdgv9Xgeiut2uBEgsP5SnxpJ5FbVSR76N2BhUJc8vqZwMwoWg8",
		"xprv9wu4xj9HBf23eLtY9AvoQSth3vA4TpE4a4SUBXHD3yK62ikgaRvVH8pMq2SzRVVG63GtPgjTKZY1CYmHkgyucgjeMKGBANpMksxDTPWtqcU",
		"xpub6AtRNEgB22aLrpy1FCTomaqRbwzYsGwuwHN4yugpcJr4uX5q7yEjpw8qgKEnAwvpsaMzgHgGWpQSi49pLAkSPG7KVsKgfyLAZiEsdcjtqeV"
	]
];
var fixtures$1 = {
	createPaths: createPaths$1
};

const network$2 = 'main';
describe('Testing Bip44 HD Key path derivation', function () {
  fixtures$1.createPaths.forEach(test => {
    it(`Deriving HD key ${test[0]} from HD Settings ${test[3]}`, async function () {
      const parentKey = fromString$1(test[0]);
      let account = 0;
      let coinType = 0;

      if (test[1]) {
        account = test[1][0];
        coinType = test[1][1];
      }

      const hdPaths = createPaths(test[2], coinType, account, 'bitcoin');
      const hdKey = await fromPaths(parentKey, hdPaths, network$2);
      let testIndex = 3;

      for (const hdPath of hdPaths) {
        const key = getKey(hdKey, hdPath.path);
        if (!key) throw new Error('No Key');
        const xprivkey = toString$1(key);
        const xpubkey = toString$1(key, network$2, true);
        assert.equal(xprivkey, test[testIndex++], 'xpriv');
        assert.equal(xpubkey, test[testIndex++], 'xpub');
      }
    });
  });
});

var keyPair = {
	fromWif: [
		[
			"L1a6bxpVHJcM9ZEUS58MM1S9NzjxsJ14iFDV4rAdfMnE5TLGDexM",
			"0251fdef9af8d59d0cce4a093fb5e48e9681bd6f45cf97220cce341a40a1c9576e"
		],
		[
			"Kwo7LquQnM5Zq7UxDEKoMWTmbAkXLn5YqtWLwaTTbkTeU2pKZ1Yd",
			"0253d03455f0a1ea1dbb859b374ba9b1fc37462c1de6e40fba568246f559ed36d9"
		],
		[
			"L22QEFSQNbnHfRc2s4geN2pDbYYoKLkevrf6okBDUB6rDcXLxeHS",
			"02703a7e625dd03d1812dd5a2a5d5d47f3e5f0c4f29823929f639c11cefbc83bf4"
		],
		[
			"Kwngkbfm8AKmp1VHEnAdHGJPcmDPVALX4ydrBrEdTzYuNm6M4EpJ",
			"02c26c5f314a91ddc90848c034933f9ef452ece480da09fef5cca299205274ad5f"
		],
		[
			"KzC6waAr74TaGJjuYGFQAikbm3H5aCNebV5xStiEKgADzDD4Xi3C",
			"03133d9b15981038a03c2cdbfbaf0c3cb4d3fd5fb5513665179e1acb42f4507ec1"
		],
		[
			"KzkH8BMjjgmvHbCGTcPfkuBKGPrTE1M2Xs6wKJ92j4DFwbvHyC4D",
			"02f1e541058d6a3da9d7654ff6abdf399859efc8733241e1a1bc16f8d1a612a418"
		]
	]
};
var fixtures$2 = {
	keyPair: keyPair
};

const KeyPairFixtures = fixtures$2.keyPair;
const network$3 = 'main';
describe('Testing HD Key', function () {
  KeyPairFixtures.fromWif.forEach(test => {
    it(`Creating Key Pair from WIF ${test[0]}`, async function () {
      const keyPair$$1 = await fromWif(test[0], network$3);
      assert.equal(keyPair$$1.publicKey, test[1]);
    });
  });
});

var name = "nidavellir";
var version = "4.1.0-alpha.5";
var description = "";
var license = "SEE LICENSE IN LICENSE";
var author = "thehobbit85";
var files = [
	"lib/*"
];
var main$e = "./lib/index.js";
var module$1 = "./lib/index.es.js";
var scripts = {
	build: "rimraf lib && rollup -c && flow-copy-source src lib && npm run build:flow",
	"build:flow": "flow-copy-source -i '**/*.test.js' src lib",
	"build:test": "rollup -c test/rollup.config.js",
	precommit: "lint-staged && npm test && npm run build",
	flow: "flow status",
	format: "import-sort -l --write '*.js' 'src/**/*.js' 'test/**/*.js'; prettier-eslint --write '*.js' 'src/**/*.js' 'test/**/*.js'",
	lint: "eslint '*.js' 'src/**/*.js' 'test/**/*.js' && npm run flow",
	prepare: "npm run build",
	security: "yarn audit",
	pretest: "npm run build:test",
	test: "nyc mocha --require source-map-support/register build/tests.cjs.js --reporter mocha-multi-reporters --reporter-options configFile=./mocha-config.json",
	posttest: "nyc report --reporter=cobertura --reporter=html",
	updot: "updot"
};
var dependencies = {
	"base-x": "^3.0.5",
	buffer: "^5.2.1"
};
var devDependencies = {
	"@babel/core": "^7.1.2",
	"@babel/plugin-proposal-object-rest-spread": "7.2.0",
	"@babel/plugin-transform-flow-strip-types": "7.2.0",
	"@babel/preset-flow": "^7.0.0",
	"babel-eslint": "^10.0.1",
	chai: "^4.2.0",
	eslint: "^5.6.1",
	"eslint-config-standard": "^12.0.0",
	"eslint-plugin-flowtype": "^3.2.0",
	"eslint-plugin-import": "2.14.0",
	"eslint-plugin-node": "^8.0.0",
	"eslint-plugin-promise": "^4.0.1",
	"eslint-plugin-standard": "^4.0.0",
	"flow-copy-source": "^2.0.2",
	husky: "^1.1.4",
	"import-sort-cli": "^5.2.0",
	"import-sort-parser-babylon": "^5.2.0",
	"import-sort-style-module": "^5.0.0",
	lerna: "^3.10.7",
	"lint-staged": "^8.0.4",
	mocha: "^5.2.0",
	"mocha-junit-reporter": "^1.18.0",
	"mocha-multi-reporters": "^1.1.7",
	mochawesome: "^3.0.3",
	nyc: "^13.0.1",
	"prettier-eslint-cli": "^4.7.1",
	rimraf: "^2.6.2",
	rollup: "0.64.0",
	"rollup-plugin-alias": "^1.4.0",
	"rollup-plugin-babel": "^4.0.1",
	"rollup-plugin-commonjs": "^9.2.0",
	"rollup-plugin-flow-entry": "^0.2.0",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-multi-entry": "^2.0.2",
	"rollup-plugin-node-resolve": "^3.4.0",
	"source-map-support": "^0.5.9",
	updot: "^1.1.7"
};
var packageJson = {
	name: name,
	version: version,
	description: description,
	license: license,
	author: author,
	files: files,
	main: main$e,
	module: module$1,
	scripts: scripts,
	dependencies: dependencies,
	devDependencies: devDependencies
};

var config = {
  input: './index.js',
  external: [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.devDependencies), 'bindings', 'elliptic'],
  output: [{
    file: packageJson.main,
    format: 'cjs',
    sourcemap: true
  }, {
    file: packageJson.module,
    format: 'es',
    sourcemap: true
  }],
  plugins: [json(), babel({
    babelrc: false,
    presets: ['@babel/preset-flow'],
    plugins: ['@babel/plugin-proposal-object-rest-spread']
  }), flowEntry()]
};

const babelOptions = {
  babelrc: false,
  presets: ['@babel/preset-flow'],
  plugins: ['@babel/plugin-proposal-object-rest-spread']
};
({
  external: config.external,
  input: './test/**/*.js',
  output: [{
    file: 'build/tests.cjs.js',
    format: 'cjs',
    sourcemap: true
  }, {
    file: 'build/tests.js',
    format: 'es',
    sourcemap: true
  }],
  plugins: [multiEntry(), json(), babel(babelOptions)]
});

var base$1 = {
	"58": {
		valid: [
			{
				string: "1AGNa15ZQXAZUgFiqJ2i7Z2DPU2J6hW62i",
				payload: "0065a16059864a2fdbc7c99a4723a8395bc6f188eb"
			},
			{
				string: "3CMNFxN1oHBc4R1EpboAL5yzHGgE611Xou",
				payload: "0574f209f6ea907e2ea48f74fae05782ae8a665257"
			},
			{
				string: "mo9ncXisMeAoXwqcV5EWuyncbmCcQN4rVs",
				payload: "6f53c0307d6851aa0ce7825ba883c6bd9ad242b486"
			},
			{
				string: "2N2JD6wb56AfK4tfmM6PwdVmoYk2dCKf4Br",
				payload: "c46349a418fc4578d10a372b54b45c280cc8c4382f"
			},
			{
				string: "5Kd3NBUAdUnhyzenEwVLy9pBKxSwXvE9FMPyR4UKZvpe6E3AgLr",
				payload: "80eddbdc1168f1daeadbd3e44c1e3f8f5a284c2029f78ad26af98583a499de5b19"
			},
			{
				string: "Kz6UJmQACJmLtaQj5A3JAge4kVTNQ8gbvXuwbmCj7bsaabudb3RD",
				payload: "8055c9bccb9ed68446d1b75273bbce89d7fe013a8acd1625514420fb2aca1a21c401"
			},
			{
				string: "9213qJab2HNEpMpYNBa7wHGFKKbkDn24jpANDs2huN3yi4J11ko",
				payload: "ef36cb93b9ab1bdabf7fb9f2c04f1b9cc879933530ae7842398eef5a63a56800c2"
			},
			{
				string: "cTpB4YiyKiBcPxnefsDpbnDxFDffjqJob8wGCEDXxgQ7zQoMXJdH",
				payload: "efb9f4892c9e8282028fea1d2667c4dc5213564d41fc5783896a0d843fc15089f301"
			},
			{
				string: "1Ax4gZtb7gAit2TivwejZHYtNNLT18PUXJ",
				payload: "006d23156cbbdcc82a5a47eee4c2c7c583c18b6bf4"
			},
			{
				string: "3QjYXhTkvuj8qPaXHTTWb5wjXhdsLAAWVy",
				payload: "05fcc5460dd6e2487c7d75b1963625da0e8f4c5975"
			},
			{
				string: "n3ZddxzLvAY9o7184TB4c6FJasAybsw4HZ",
				payload: "6ff1d470f9b02370fdec2e6b708b08ac431bf7a5f7"
			},
			{
				string: "2NBFNJTktNa7GZusGbDbGKRZTxdK9VVez3n",
				payload: "c4c579342c2c4c9220205e2cdc285617040c924a0a"
			},
			{
				string: "5K494XZwps2bGyeL71pWid4noiSNA2cfCibrvRWqcHSptoFn7rc",
				payload: "80a326b95ebae30164217d7a7f57d72ab2b54e3be64928a19da0210b9568d4015e"
			},
			{
				string: "L1RrrnXkcKut5DEMwtDthjwRcTTwED36thyL1DebVrKuwvohjMNi",
				payload: "807d998b45c219a1e38e99e7cbd312ef67f77a455a9b50c730c27f02c6f730dfb401"
			},
			{
				string: "93DVKyFYwSN6wEo3E2fCrFPUp17FtrtNi2Lf7n4G3garFb16CRj",
				payload: "efd6bca256b5abc5602ec2e1c121a08b0da2556587430bcf7e1898af2224885203"
			},
			{
				string: "cTDVKtMGVYWTHCb1AFjmVbEbWjvKpKqKgMaR3QJxToMSQAhmCeTN",
				payload: "efa81ca4e8f90181ec4b61b6a7eb998af17b2cb04de8a03b504b9e34c4c61db7d901"
			},
			{
				string: "1C5bSj1iEGUgSTbziymG7Cn18ENQuT36vv",
				payload: "007987ccaa53d02c8873487ef919677cd3db7a6912"
			},
			{
				string: "3AnNxabYGoTxYiTEZwFEnerUoeFXK2Zoks",
				payload: "0563bcc565f9e68ee0189dd5cc67f1b0e5f02f45cb"
			},
			{
				string: "n3LnJXCqbPjghuVs8ph9CYsAe4Sh4j97wk",
				payload: "6fef66444b5b17f14e8fae6e7e19b045a78c54fd79"
			},
			{
				string: "2NB72XtkjpnATMggui83aEtPawyyKvnbX2o",
				payload: "c4c3e55fceceaa4391ed2a9677f4a4d34eacd021a0"
			},
			{
				string: "5KaBW9vNtWNhc3ZEDyNCiXLPdVPHCikRxSBWwV9NrpLLa4LsXi9",
				payload: "80e75d936d56377f432f404aabb406601f892fd49da90eb6ac558a733c93b47252"
			},
			{
				string: "L1axzbSyynNYA8mCAhzxkipKkfHtAXYF4YQnhSKcLV8YXA874fgT",
				payload: "808248bd0375f2f75d7e274ae544fb920f51784480866b102384190b1addfbaa5c01"
			},
			{
				string: "927CnUkUbasYtDwYwVn2j8GdTuACNnKkjZ1rpZd2yBB1CLcnXpo",
				payload: "ef44c4f6a096eac5238291a94cc24c01e3b19b8d8cef72874a079e00a242237a52"
			},
			{
				string: "cUcfCMRjiQf85YMzzQEk9d1s5A4K7xL5SmBCLrezqXFuTVefyhY7",
				payload: "efd1de707020a9059d6d3abaf85e17967c6555151143db13dbb06db78df0f15c6901"
			},
			{
				string: "1Gqk4Tv79P91Cc1STQtU3s1W6277M2CVWu",
				payload: "00adc1cc2081a27206fae25792f28bbc55b831549d"
			},
			{
				string: "33vt8ViH5jsr115AGkW6cEmEz9MpvJSwDk",
				payload: "05188f91a931947eddd7432d6e614387e32b244709"
			},
			{
				string: "mhaMcBxNh5cqXm4aTQ6EcVbKtfL6LGyK2H",
				payload: "6f1694f5bc1a7295b600f40018a618a6ea48eeb498"
			},
			{
				string: "2MxgPqX1iThW3oZVk9KoFcE5M4JpiETssVN",
				payload: "c43b9b3fd7a50d4f08d1a5b0f62f644fa7115ae2f3"
			},
			{
				string: "5HtH6GdcwCJA4ggWEL1B3jzBBUB8HPiBi9SBc5h9i4Wk4PSeApR",
				payload: "80091035445ef105fa1bb125eccfb1882f3fe69592265956ade751fd095033d8d0"
			},
			{
				string: "L2xSYmMeVo3Zek3ZTsv9xUrXVAmrWxJ8Ua4cw8pkfbQhcEFhkXT8",
				payload: "80ab2b4bcdfc91d34dee0ae2a8c6b6668dadaeb3a88b9859743156f462325187af01"
			},
			{
				string: "92xFEve1Z9N8Z641KQQS7ByCSb8kGjsDzw6fAmjHN1LZGKQXyMq",
				payload: "efb4204389cef18bbe2b353623cbf93e8678fbc92a475b664ae98ed594e6cf0856"
			},
			{
				string: "cVM65tdYu1YK37tNoAyGoJTR13VBYFva1vg9FLuPAsJijGvG6NEA",
				payload: "efe7b230133f1b5489843260236b06edca25f66adb1be455fbd38d4010d48faeef01"
			},
			{
				string: "1JwMWBVLtiqtscbaRHai4pqHokhFCbtoB4",
				payload: "00c4c1b72491ede1eedaca00618407ee0b772cad0d"
			},
			{
				string: "3QCzvfL4ZRvmJFiWWBVwxfdaNBT8EtxB5y",
				payload: "05f6fe69bcb548a829cce4c57bf6fff8af3a5981f9"
			},
			{
				string: "mizXiucXRCsEriQCHUkCqef9ph9qtPbZZ6",
				payload: "6f261f83568a098a8638844bd7aeca039d5f2352c0"
			},
			{
				string: "2NEWDzHWwY5ZZp8CQWbB7ouNMLqCia6YRda",
				payload: "c4e930e1834a4d234702773951d627cce82fbb5d2e"
			},
			{
				string: "5KQmDryMNDcisTzRp3zEq9e4awRmJrEVU1j5vFRTKpRNYPqYrMg",
				payload: "80d1fab7ab7385ad26872237f1eb9789aa25cc986bacc695e07ac571d6cdac8bc0"
			},
			{
				string: "L39Fy7AC2Hhj95gh3Yb2AU5YHh1mQSAHgpNixvm27poizcJyLtUi",
				payload: "80b0bbede33ef254e8376aceb1510253fc3550efd0fcf84dcd0c9998b288f166b301"
			},
			{
				string: "91cTVUcgydqyZLgaANpf1fvL55FH53QMm4BsnCADVNYuWuqdVys",
				payload: "ef037f4192c630f399d9271e26c575269b1d15be553ea1a7217f0cb8513cef41cb"
			},
			{
				string: "cQspfSzsgLeiJGB2u8vrAiWpCU4MxUT6JseWo2SjXy4Qbzn2fwDw",
				payload: "ef6251e205e8ad508bab5596bee086ef16cd4b239e0cc0c5d7c4e6035441e7d5de01"
			},
			{
				string: "19dcawoKcZdQz365WpXWMhX6QCUpR9SY4r",
				payload: "005eadaf9bb7121f0f192561a5a62f5e5f54210292"
			},
			{
				string: "37Sp6Rv3y4kVd1nQ1JV5pfqXccHNyZm1x3",
				payload: "053f210e7277c899c3a155cc1c90f4106cbddeec6e"
			},
			{
				string: "myoqcgYiehufrsnnkqdqbp69dddVDMopJu",
				payload: "6fc8a3c2a09a298592c3e180f02487cd91ba3400b5"
			},
			{
				string: "2N7FuwuUuoTBrDFdrAZ9KxBmtqMLxce9i1C",
				payload: "c499b31df7c9068d1481b596578ddbb4d3bd90baeb"
			},
			{
				string: "5KL6zEaMtPRXZKo1bbMq7JDjjo1bJuQcsgL33je3oY8uSJCR5b4",
				payload: "80c7666842503db6dc6ea061f092cfb9c388448629a6fe868d068c42a488b478ae"
			},
			{
				string: "KwV9KAfwbwt51veZWNscRTeZs9CKpojyu1MsPnaKTF5kz69H1UN2",
				payload: "8007f0803fc5399e773555ab1e8939907e9badacc17ca129e67a2f5f2ff84351dd01"
			},
			{
				string: "93N87D6uxSBzwXvpokpzg8FFmfQPmvX4xHoWQe3pLdYpbiwT5YV",
				payload: "efea577acfb5d1d14d3b7b195c321566f12f87d2b77ea3a53f68df7ebf8604a801"
			},
			{
				string: "cMxXusSihaX58wpJ3tNuuUcZEQGt6DKJ1wEpxys88FFaQCYjku9h",
				payload: "ef0b3b34f0958d8a268193a9814da92c3e8b58b4a4378a542863e34ac289cd830c01"
			},
			{
				string: "13p1ijLwsnrcuyqcTvJXkq2ASdXqcnEBLE",
				payload: "001ed467017f043e91ed4c44b4e8dd674db211c4e6"
			},
			{
				string: "3ALJH9Y951VCGcVZYAdpA3KchoP9McEj1G",
				payload: "055ece0cadddc415b1980f001785947120acdb36fc"
			}
		],
		invalid: [
			{
				string: "Z9inZq4e2HGQRZQezDjFMmqgUE8NwMRok",
				exception: "Invalid checksum"
			},
			{
				string: "3HK7MezAm6qEZQUMPRf8jX7wDv6zig6Ky8",
				exception: "Invalid checksum"
			},
			{
				string: "3AW8j12DUk8mgA7kkfZ1BrrzCVFuH1LsXS",
				exception: "Invalid checksum"
			},
			{
				string: "#####",
				exception: "Non-base58 character"
			}
		]
	}
};
var persister = {
	"scenario 1": {
		cache: {
			a: 1,
			b: 2,
			c: 3,
			d: 4,
			e: 5
		},
		delay: 50,
		sets: [
			[
				"a",
				5,
				50
			],
			[
				"b",
				4,
				100
			],
			[
				"c",
				3,
				150
			],
			[
				"d",
				2,
				200
			],
			[
				"e",
				1,
				250
			]
		]
	},
	"scenario 2": {
		delay: 50,
		sets: [
			[
				"a",
				1,
				50
			],
			[
				"b",
				1,
				100
			],
			[
				"a",
				1,
				150
			],
			[
				"b",
				2,
				200
			],
			[
				"c",
				3,
				250
			]
		]
	},
	"scenario 3": {
		cache: {
			a: 100,
			b: 200,
			c: 300,
			z: {
				a: 1
			}
		},
		sets: [
			[
				"a",
				10000,
				6
			],
			[
				"a",
				1000,
				12
			],
			[
				"a",
				100,
				18
			],
			[
				"a",
				10,
				24
			],
			[
				"a",
				1,
				30
			],
			[
				"b",
				2,
				40
			],
			[
				"c",
				3,
				60
			],
			[
				"d",
				4,
				80
			],
			[
				"a",
				10,
				110
			],
			[
				"e",
				5,
				120
			],
			[
				"z.a",
				200,
				150
			],
			[
				"f",
				6,
				170
			],
			[
				"f",
				6,
				300
			],
			[
				"b",
				2,
				360
			],
			[
				"f",
				6,
				380
			],
			[
				"f",
				6,
				420
			],
			[
				"t",
				7,
				540
			],
			[
				"z.a",
				200,
				560
			],
			[
				"z.a",
				1000,
				640
			],
			[
				"c",
				3,
				680
			],
			[
				"z.a",
				1000,
				720
			],
			[
				"a",
				1000,
				780
			]
		]
	},
	"scenario 4": {
		cache: {
			a: 1,
			b: 2,
			c: 3,
			d: 4,
			e: 5
		},
		delay: 50,
		sets: [
			[
				"a",
				10,
				0
			],
			[
				"b",
				20,
				0
			],
			[
				"c",
				30,
				0
			],
			[
				"d",
				40,
				0
			],
			[
				"e",
				50,
				100
			]
		]
	},
	"scenario 5": {
		cache: {
			a: 1,
			b: 2,
			c: 3,
			d: 4,
			e: 5
		},
		delay: 0,
		sets: [
			[
				"a",
				10,
				0
			],
			[
				"b",
				20,
				0
			],
			[
				"c",
				30,
				0
			],
			[
				"d",
				40,
				0
			],
			[
				"e",
				50,
				0
			]
		]
	}
};
var fixtures$3 = {
	base: base$1,
	persister: persister
};

const key = '00ab0063a7ea84d7c5f4a9ad8690c69b80a2d650343fbc9266b2d73c7b26bb2cc780000020';
const data = '485efe44bc445946b58ba03e8da75d5cf44fc9196eaa88204667629c4e04c38d';
const res = '405fcc33d3f409f16571e19bd27053cd1d05e74df6eba0dc93c4c0a91599052429203b410e284513e14f67287843f91875bf69986f9cebf7037e79b0b13bbdbc';
const baseFixtures = fixtures$3.base;
const hash = sha512Hmac(key, data);
assert.equal(hash, res);

for (const fixture in baseFixtures) {
  describe(`Testing base ${fixture}`, function () {
    const fixtureBase = base[fixture].check;
    baseFixtures[fixture].valid.forEach(({
      string,
      payload
    }) => {
      it(`Decode valid string: ${string}`, async function () {
        const resultedPaylod = fixtureBase.decode(string);
        assert.equal(resultedPaylod, payload);
      });
      it(`Encode valid payload: ${payload}`, async function () {
        const resultedString = fixtureBase.encode(payload);
        assert.equal(resultedString, string);
      });
    });
    baseFixtures[fixture].invalid.forEach(({
      string,
      exception
    }) => {
      it(`Test invalid string: ${string}`, async function () {
        try {
          fixtureBase.decode(string);
        } catch (e) {
          assert.equal(e.message, exception);
        }
      });
    });
  });
}

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

const createSave = (expected, delay, cbs) => {
  let saveAttempts = -1;
  let firstSaveTime = 0;
  return async cacheData => {
    if (cbs.stop) return;
    cbs.e = new Error();
    assert.notEqual(cacheData, expected);
    assert.deepEqual(cacheData, expected);
    saveAttempts++;
    if (!firstSaveTime) firstSaveTime = Date.now();
    const saveTime = Date.now() - firstSaveTime;

    if (delay) {
      const minDelay = delay * saveAttempts;
      assert.isAtLeast(saveTime, minDelay);
    }

    cbs.e = null; // console.log(saveTime, '- SAVE -', cacheData, saveAttempts)
  };
};

const cbs = {};

for (const test in fixtures$3.persister) {
  const testNum = test.replace('scenario ', '');
  const {
    cache,
    delay,
    sets
  } = fixtures$3.persister[test];
  const expected = JSON.parse(JSON.stringify(cache || {}));
  const save = createSave(expected, delay, cbs);
  const load = testNum !== '1' ? () => expected : cache;
  const persistedCache = persist(save, load, delay);
  describe(`Testing persister for ${test} with delay of ${delay || 100}ms`, function () {
    this.timeout(0);
    before('Test using cache as a function', async function () {
      cbs.stop = false;
      await persistedCache({});
      await persistedCache(cache);
    });
    sets.map(([param, value, saveTime], i) => {
      it(`Set '${param}' to ${value}, after ${saveTime} milliseconds`, function (done) {
        let child = persistedCache;
        let expectedChild = expected;
        param = param.split('.');

        while (param.length > 1) {
          const key = param.shift();
          child = child[key];
          expectedChild = expectedChild[key];
        }

        const key = param[0];
        const interval = !i ? saveTime : saveTime - sets[i - 1][2];
        setTimeout(() => {
          expectedChild[key] = value;
          child[key] = value;
          assert.equal(expectedChild[key], child[key]);
          done(cbs.e);
        }, interval);
      });
    });
    after('Stop the caceh using cache as a function', async function () {
      cbs.stop = true;
      await persistedCache('stop');
    });
  });
}
//# sourceMappingURL=tests.js.map
