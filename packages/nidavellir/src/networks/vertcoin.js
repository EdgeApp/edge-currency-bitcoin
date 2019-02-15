// @flow

export const main = {
  magic: 0xd9b4bef9,
  supportedBips: [84, 49, 44, 32],
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
}
