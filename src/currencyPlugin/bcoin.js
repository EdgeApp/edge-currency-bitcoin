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
    const mainBcoinSettings = bcoin.protocol.networks.main
    const testBcoinSettings = bcoin.protocol.networks.testnet
    if (networkSettings.main) {
      if (typeof networkSettings.main.magic === 'number') {
        mainBcoinSettings.magic = networkSettings.main.magic
      }
      if (networkSettings.main.keyPrefix) {
        mainBcoinSettings.keyPrefix = networkSettings.main.keyPrefix
      }
      if (networkSettings.main.addressPrefix) {
        mainBcoinSettings.addressPrefix = networkSettings.main.addressPrefix
      }
    }
    if (networkSettings.testnet) {
      if (typeof networkSettings.testnet.magic === 'number') {
        testBcoinSettings.magic = networkSettings.testnet.magic
      }
      if (networkSettings.testnet.keyPrefix) {
        testBcoinSettings.keyPrefix = networkSettings.testnet.keyPrefix
      }
      if (networkSettings.testnet.addressPrefix) {
        testBcoinSettings.addressPrefix = networkSettings.testnet.addressPrefix
      }
    }
  }
  return bcoin
}
