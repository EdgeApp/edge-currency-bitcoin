// @flow

import { bns } from 'biggystring'

import { KeyManager } from '../../engine/keyManager'
import type { PluginIo } from '../../plugin/pluginIo'
import { getPrivateFromSeed } from '../../utils/coinUtils'
import type { PrivateCoin } from '../zcoins'
import { BIP44_MINT_INDEX, DENOMINATIONS, SIGMA_COIN } from '../zcoins'

export type SpendCoin = {
  value: number,
  index: number,
  anonymitySet: string[],
  groupId: number,
  blockHash: string
}

export const createPrivateCoin = async (
  value: number,
  privateKey: any,
  index: number,
  io: PluginIo
): Promise<PrivateCoin> => {
  const mintPrivateKey = await createPrivateKeyForIndex(privateKey, index)

  const { commitment, serialNumber } = await io.sigmaMint({
    denomination: value / SIGMA_COIN,
    privateKey: mintPrivateKey,
    index
  })
  return {
    value,
    index,
    commitment: commitment,
    serialNumber: serialNumber,
    groupId: 0,
    isSpend: false,
    spendTxId: ''
  }
}

export const createMintBranchPrivateKey = async (
  keyManager: KeyManager
): Promise<any> => {
  const path = keyManager.masterPath + '/' + BIP44_MINT_INDEX
  const priv = await getPrivateFromSeed(keyManager.seed, keyManager.network)
  const bip44Mint = await priv.derivePath(path)

  return bip44Mint
}

export const createPrivateKeyForIndex = async (
  key: any,
  index: number
): Promise<string> => {
  const forIndex = await key.derive(index)
  return forIndex.privateKey.toString('hex')
}

export const getMintCommitmentsForValue = async (
  value: string,
  privateKey: any,
  currentIndex: number,
  io: PluginIo
) => {
  const result: Array<PrivateCoin> = []
  for (let i = DENOMINATIONS.length - 1; i >= 0; i--) {
    const denom = DENOMINATIONS[i]

    while (bns.gte(value, denom)) {
      value = bns.sub(value, denom)
      currentIndex++
      const pCoin = await createPrivateCoin(
        parseInt(denom),
        privateKey,
        currentIndex,
        io
      )
      result.push(pCoin)
    }
  }

  return result
}
