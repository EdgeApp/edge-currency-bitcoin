// @flow

const main = {
  supportedBips: [84, 49],
  forks: ['bitcoincash', 'bitcoingold', 'bitcoindiamond'],
  addressPrefix: {
    witnesspubkeyhash: 0x06,
    witnessscripthash: 0x0a,
    bech32: 'bc'
  }
}

const testnet = {
  ...main,
  addressPrefix: {
    witnesspubkeyhash: 0x03,
    witnessscripthash: 0x28,
    bech32: 'tb'
  }
}

module.exports = { main, testnet }
