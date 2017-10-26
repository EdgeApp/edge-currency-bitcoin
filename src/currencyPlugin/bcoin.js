// @flow

export default (txLibInfo: any) => {
  const currencyName = txLibInfo.getInfo.currencyName.toLowerCase()
  let bcoin
  if (currencyName === 'bitcoin') {
    bcoin = require('bcoin')
  } else if (currencyName === 'bitcoincash') {
    bcoin = require('bccoin')
  } else {
    bcoin = require('lcoin')
  }
  if (txLibInfo &&
    txLibInfo.getInfo &&
    txLibInfo.getInfo.defaultsSettings &&
    txLibInfo.getInfo.defaultsSettings.networkSettings) {
    const networkSettings = txLibInfo.getInfo.defaultsSettings.networkSettings
    if (networkSettings.main) {
      if (typeof networkSettings.main.magic === 'number') {
        bcoin.protocol.networks.main.magic = networkSettings.main.magic
      }
      if (networkSettings.main.keyPrefix) {
        bcoin.protocol.networks.main.keyPrefix = networkSettings.main.keyPrefix
      }
      if (networkSettings.main.addressPrefix) {
        bcoin.protocol.networks.main.addressPrefix = networkSettings.main.addressPrefix
      }
    }
    if (networkSettings.testnet) {
      if (typeof networkSettings.testnet.magic === 'number') {
        bcoin.protocol.networks.testnet.magic = networkSettings.testnet.magic
      }
      if (networkSettings.testnet.keyPrefix) {
        bcoin.protocol.networks.testnet.keyPrefix = networkSettings.testnet.keyPrefix
      }
      if (networkSettings.testnet.addressPrefix) {
        bcoin.protocol.networks.testnet.addressPrefix = networkSettings.testnet.addressPrefix
      }
    }
  }
  return bcoin
}
