import txLibInfo from './currencyInfo'
const lcoin = require('lcoin')

const networkSettings = {
  main: {
    magic: 0x00000000,
    keyPrefix: {
      privkey: 0xb0,
      xpubkey: 0x00000000,
      xprivkey: 0x00000000,
      xprivkey58: 'xprv',
      xpubkey58: 'xpub',
      coinType: 0
    },
    addressPrefix: {
      pubkeyhash: 0x30,
      scripthash: 0x32,
      witnesspubkeyhash: 0x06,
      witnessscripthash: 0x0a,
      bech32: 'lc'
    }
  },
  testnet: {
    magic: 0x00000000,
    keyPrefix: {
      privkey: 0xef,
      xpubkey: 0x00000000,
      xprivkey: 0x00000000,
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
  }
}

lcoin.protocol.networks.main.magic = networkSettings.main.magic
lcoin.protocol.networks.main.keyPrefix = networkSettings.main.keyPrefix
lcoin.protocol.networks.main.addressPrefix = networkSettings.main.addressPrefix
lcoin.protocol.networks.testnet.magic = networkSettings.testnet.magic
lcoin.protocol.networks.testnet.keyPrefix = networkSettings.testnet.keyPrefix
lcoin.protocol.networks.testnet.addressPrefix = networkSettings.testnet.addressPrefix

export default [0xB0, 0x30, txLibInfo, lcoin]
