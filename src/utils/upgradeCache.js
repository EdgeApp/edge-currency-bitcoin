// @flow
import {
  type EdgeCurrencyEngineOptions,
  type EdgeWalletInfo
} from 'edge-core-js/types'

import { type EngineCurrencyInfo } from '../engine/currencyEngine.js'
import { toNewFormat } from '../utils/addressFormat.js'
import { parsePath } from '../utils/coinUtils.js'
import { formatSelector } from '../utils/formatSelector.js'

const versionNumber = 3

const version3 = async (
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
        let tempAddress
        // This branch number represents the replay protection branch on bitcoincash wallets
        if (branch === 146473132) {
          const { address } = await fSelector.deriveScriptAddress(
            pubKey,
            index,
            branch
          )
          tempAddress = address
        } else {
          const { address } = await fSelector.deriveAddress(pubKey, index)
          tempAddress = address
        }
        addressObj.displayAddress = toNewFormat(tempAddress, network)
      }
      const stringifiedAddresses = JSON.stringify(cacheJson)
      await localDisklet.setText('addresses.json', stringifiedAddresses)
    } catch (e) {}
  }
  await localDisklet.setText('version.txt', `${versionNumber}`)
}

export const checkCacheVersion = async (
  options: EdgeCurrencyEngineOptions,
  walletInfo: EdgeWalletInfo,
  engineInfo: EngineCurrencyInfo
) => {
  try {
    // should fail in case of no version file (version 1)
    const version = await options.walletLocalDisklet.getText('version.txt')
    if (parseInt(version) < versionNumber) throw new Error()
  } catch (e) {
    await version3(options, walletInfo, engineInfo)
  }
}
