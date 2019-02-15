// @flow

export const main = {
  magic: 0x0709110b,
  supportedBips: [84, 49],
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
}

export const testnet = {
  ...main,
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
}
