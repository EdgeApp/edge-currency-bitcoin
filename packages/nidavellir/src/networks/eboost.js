// @flow

export const main = {
  magic: 0xd9b4bef9,
  supportedBips: [84, 49],
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
}
