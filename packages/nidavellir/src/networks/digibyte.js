// @flow

export const main = {
  magic: 0xd9b4bef9,
  supportedBips: [84, 49],
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
}
