// @flow

export const main = {
  magic: 0xd9b4bef9,
  keyPrefix: {
    coinType: 145
  },
  addressPrefix: {
    cashAddress: "bitcoincash"
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
