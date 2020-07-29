// @flow

import type { MTX } from 'bcoin'
import { networks, primitives, script, txscript } from 'bcoin'
import { bns } from 'biggystring'

import type { EngineState } from '../../engine/engineState'
import { KeyManager } from '../../engine/keyManager'
import type { PluginIo } from '../../plugin/pluginIo'
import { toNewFormat } from '../../utils/addressFormat.js'
import type { StandardOutput } from '../../utils/coinUtils'
import { getPrivateFromSeed, toBcoinFormat } from '../../utils/coinUtils'
import { logger } from '../../utils/logger'
import type { PrivateCoin } from '../zcoins'
import {
  BIP44_MINT_INDEX,
  DENOMINATIONS,
  OP_SIGMA_MINT,
  OP_SIGMA_SPEND,
  SIGMA_COIN
} from '../zcoins'

export type SpendCoin = {
  value: number,
  index: number,
  anonymitySet: string[],
  groupId: number,
  blockHash: string
}

export type CreateSpendTxOptions = {
  mints: SpendCoin[],
  changeAddress: string,
  network: string,
  outputs: Array<StandardOutput>
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

const repeatString = (length: number, str: string): string => {
  return new Array(length).join(str)
}

const createEmptyMintCommitmentsForValue = async (value: string) => {
  const result: Array<PrivateCoin> = []
  const emptyCommitment = repeatString(36, OP_SIGMA_MINT)
  for (let i = DENOMINATIONS.length - 1; i >= 0; i--) {
    const denom = DENOMINATIONS[i]

    while (bns.gte(value, denom)) {
      value = bns.sub(value, denom)
      result.push({
        value: parseInt(denom),
        index: -1,
        commitment: emptyCommitment,
        serialNumber: '',
        groupId: -1,
        isSpend: false,
        spendTxId: ''
      })
    }
  }

  return result
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

const fillSpendScriptIntoTX = async (
  mints: SpendCoin[],
  value: number,
  privateKey: any,
  io: PluginIo,
  mtx: MTX
) => {
  const hash = mtx.rhash()

  for (let i = 0; i < mints.length; i++) {
    const mint = mints[i]

    const mintPrivateKey = await createPrivateKeyForIndex(
      privateKey,
      mint.index
    )

    const spendProof = await io.sigmaSpend({
      denomination: mint.value / SIGMA_COIN,
      privateKey: mintPrivateKey,
      index: mint.index,
      anonymitySet: mint.anonymitySet,
      groupId: mint.groupId,
      blockHash: mint.blockHash,
      txHash: hash
    })

    mtx.inputs[i].script.fromRaw(
      Buffer.from(OP_SIGMA_SPEND + spendProof, 'hex')
    )
  }
}

export const parseJsonTransactionForSpend = (txJson: Object): MTX => {
  // Create a bcoin transaction instance. At this stage it WON'T contain the utxo information for the inputs
  const bcoinTx = primitives.MTX.fromJSON(txJson)
  return bcoinTx
}

export const createSpendTX = async ({
  mints,
  changeAddress,
  outputs,
  network
}: CreateSpendTxOptions) => {
  if (mints.length === 0) {
    throw new Error('No mints available.')
  }
  if (outputs.length === 0) {
    throw new Error('No outputs available.')
  }

  const { address, value } = outputs[0]
  const bcoinAddress = toBcoinFormat(address, network)
  const addressScript = script.fromAddress(bcoinAddress)

  // create transaction
  const cb = new primitives.MTX().fromOptions({ locktime: 126395 })

  // mint if can
  let sumOfMint = '0'
  let needToMint = bns.sub('0', value.toString())
  mints.forEach(m => {
    needToMint = bns.add(needToMint, m.value.toString())
  })
  const privateCoins = await createEmptyMintCommitmentsForValue(needToMint)

  privateCoins.forEach((coin, index) => {
    cb.addOutput(addressScript, coin.value)
    cb.outputs[index].address = null
    cb.outputs[index].script.fromRaw(Buffer.from(coin.commitment, 'hex'))

    sumOfMint = bns.add(sumOfMint, coin.value.toString())
  })

  const feeThatCanBeSubtractFromHere = parseInt(bns.sub(needToMint, sumOfMint))

  // fill send value
  cb.addOutput(script.fromAddress(bcoinAddress), value)

  const proof = Buffer.from(repeatString(1321, OP_SIGMA_SPEND), 'hex')
  mints.forEach(mint => {
    cb.addInput({
      prevout: new primitives.Outpoint().fromOptions({
        hash:
          '0000000000000000000000000000000000000000000000000000000000000000',
        index: 1
      }),
      script: new txscript.Script().fromRaw(proof),
      sequence: 0xffffffff
    })
  })

  const fee = Math.max(cb.getVirtualSize() - feeThatCanBeSubtractFromHere, 0)

  cb.outputs[cb.outputs.length - 1].value -= fee

  return {
    tx: cb,
    mints: privateCoins,
    spendFee: fee,
    value
  }
}

export const signSpendTX = async (
  tx: MTX,
  value: number,
  currentIndex: number,
  privateKey: any,
  spendCoins: SpendCoin[],
  io: PluginIo
): Promise<{ txid: string, signedTx: string, mintsForSave: PrivateCoin[] }> => {
  const mtx = tx // new primitives.MTX(tx)

  for (let i = 0; i < mtx.inputs.length; ++i) {
    mtx.inputs[i].script.clear()
  }

  const mintsForSave = []
  for (let i = 0; i < mtx.outputs.length; ++i) {
    const script = mtx.outputs[i].script.toRaw().toString('hex')
    if (!script.startsWith(OP_SIGMA_MINT)) {
      continue
    }
    const pCoin = await createPrivateCoin(
      mtx.outputs[i].value,
      privateKey,
      ++currentIndex,
      io
    )
    mintsForSave.push(pCoin)

    const commitment = Buffer.from(OP_SIGMA_MINT + pCoin.commitment, 'hex')
    mtx.outputs[i].script.fromRaw(commitment)
  }

  await fillSpendScriptIntoTX(spendCoins, value, privateKey, io, mtx)

  const txid = mtx.rhash()
  return { txid, signedTx: mtx.toRaw().toString('hex'), mintsForSave }
}

export const sumTransaction = (
  bcoinTransaction: any,
  network: string,
  engineState: EngineState,
  spendValue: number
): {
  nativeAmount: number,
  fee: number,
  ourReceiveAddresses: string[],
  isMint: boolean
} => {
  const ourReceiveAddresses = []
  let totalOutputAmount = 0
  let totalInputAmount = 0
  let nativeAmount = 0
  let totalMintAmount = 0
  let address = ''
  let value = 0
  let output = null
  let type = null

  // Process tx outputs
  const outputsLength = bcoinTransaction.outputs.length
  for (let i = 0; i < outputsLength; i++) {
    output = bcoinTransaction.outputs[i]
    type = output.getType()
    if (type === 'nonstandard') {
      totalMintAmount += output.value
      totalOutputAmount += output.value
      continue
    }

    if (type === 'nulldata') {
      continue
    }

    output = output.getJSON(network)
    value = output.value
    try {
      address = toNewFormat(output.address, network)
      const { serializers = {} } = networks[network] || {}
      address = serializers.address
        ? serializers.address.encode(address)
        : address
    } catch (e) {
      logger.error(e)
      if (value <= 0) {
        continue
      } else {
        address = ''
      }
    }
    totalOutputAmount += value
    if (engineState.scriptHashes[address]) {
      nativeAmount += value
      ourReceiveAddresses.push(address)
    }
  }

  let input = null
  let prevoutBcoinTX = null
  let index = 0
  let hash = ''
  // Process tx inputs
  const inputsLength = bcoinTransaction.inputs.length
  for (let i = 0; i < inputsLength; i++) {
    input = bcoinTransaction.inputs[i]
    if (input.prevout) {
      hash = input.prevout.rhash()
      index = input.prevout.index
      prevoutBcoinTX = engineState.parsedTxs[hash]
      if (prevoutBcoinTX) {
        output = prevoutBcoinTX.outputs[index].getJSON(network)
        value = output.value
        address = toNewFormat(output.address, network)
        const { serializers = {} } = networks[network] || {}
        address = serializers.address
          ? serializers.address.encode(address)
          : address
        totalInputAmount += value
        if (engineState.scriptHashes[address]) {
          nativeAmount -= value
        }
      }
    }
  }

  const isOwnSpend: boolean = spendValue !== undefined
  if (isOwnSpend) {
    totalInputAmount += spendValue
    nativeAmount += totalMintAmount
    nativeAmount -= spendValue
  }
  const fee = totalInputAmount ? totalInputAmount - totalOutputAmount : 0
  return {
    nativeAmount,
    fee,
    ourReceiveAddresses,
    isMint: totalMintAmount > 0 && !isOwnSpend && nativeAmount < 0
  }
}
