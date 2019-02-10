// @flow

const main = {
  supportedBips: [84, 49],
  forks: ['bitcoincash', 'bitcoingold', 'bitcoindiamond'],
  addressPrefix: {
    pubkeyhash: 0x00,
    scripthash: 0x05,
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'bc'
  }
}

const testnet = {
  ...main,
  addressPrefix: {
    pubkeyhash: 0x6f,
    scripthash: 0xc4,
    witnesspubkeyhash: 0x03,
    witnessscripthash: 0x28,
    bech32: 'tb'
  }
}

module.exports = { main, testnet }
