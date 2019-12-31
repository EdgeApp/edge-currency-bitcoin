// @flow
import {
  type EdgeCurrencyEngineOptions,
  type EdgeWalletInfo
} from 'edge-core-js/types'

import { type EngineCurrencyInfo } from '../engine/currencyEngine.js'
import { toNewFormat } from '../utils/addressFormat.js'
import { parsePath } from '../utils/coinUtils.js'
import { formatSelector } from '../utils/formatSelector.js'

const version2 = async (
  options: EdgeCurrencyEngineOptions,
  walletInfo: EdgeWalletInfo,
  engineInfo: EngineCurrencyInfo
) => {
  const { walletLocalDisklet: localDisklet } = options
  const { network } = engineInfo
  const { keys = {} } = walletInfo
  const { format, coinType } = keys
  const seed = keys[`${network}Key`]
  // if no version present
  if (
    network === 'bitcoincash' ||
    network === 'bitcoinsv' ||
    network === 'bitcointestnet'
  ) {
    try {
      const cacheText = await localDisklet.getText('addresses.json')
      const cacheJson = JSON.parse(cacheText)
      const fSelector = formatSelector(format, network)
      const masterPath = fSelector.createMasterPath(0, coinType)
      const masterKeys = await fSelector.getMasterKeys(seed, masterPath)
      for (const addressHex in cacheJson.addresses) {
        const addressObj = cacheJson.addresses[addressHex]
        const [branch, index] = parsePath(addressObj.path, masterPath)
        const pubKey = await fSelector.deriveHdKey(masterKeys.pubKey, branch)
        const { address } = await fSelector.deriveAddress(pubKey, index)
        addressObj.displayAddress = toNewFormat(address, network)
      }
      const stringifiedAddresses = JSON.stringify(cacheJson)
      await localDisklet.setText('addresses.json', stringifiedAddresses)
      await localDisklet.setText('version.txt', '2')
    } catch (e) {}
  } else {
    await localDisklet.setText('version.txt', '2')
  }
}

export const checkCacheVersion = async (
  options: EdgeCurrencyEngineOptions,
  walletInfo: EdgeWalletInfo,
  engineInfo: EngineCurrencyInfo
) => {
  try {
    // should fail in case of no version file (version 1)
    await options.walletLocalDisklet.getText('version.txt')
  } catch (e) {
    await version2(options, walletInfo, engineInfo)
  }
}
