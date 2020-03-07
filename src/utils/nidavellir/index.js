// @flow

import * as Derive from "./bip32/derive.js";
import * as ExtendedKey from "./bip32/extendedKey.js";
import * as HDKey from "./bip32/hdKey.js";
import * as Paths from "./bip44/paths.js";
import * as KeyPair from "./core/keyPair.js";
import * as NetworkInfo from "./core/networkInfo.js";
import * as Base from "./utils/base.js";
import * as Formatter from "./utils/formatter.js";
import * as Hash from "./utils/hash.js";
import * as Persister from "./utils/persister.js";
import * as Require from "./utils/require.js";
import * as Secp256k1 from "./utils/secp256k1.js";
import * as UintArray from "./utils/uintArray.js";

const Networks = NetworkInfo.networks;

export const Core = { KeyPair, Networks, NetworkInfo };
export const HD = { Derive, ExtendedKey, HDKey, Paths };
export const Utils = {
  Base,
  Formatter,
  Hash,
  Require,
  Secp256k1,
  Persister,
  UintArray
};

export * from "./types/types.js";
