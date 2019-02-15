// @flow

export const main = {
  magic: 0xfcd9b7dd,
  supportedBips: [84, 49, 44, 32],
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
}
