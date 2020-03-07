// @flow

import bcoin from 'bcoin'

import {
  type CreateTxOptions,
  type KeyRings,
  type Utxo
} from '../../../types/bcoinUtils.js'
import {
  toBitcoinFormat,
  toNewFormat
} from '../addressFormat/addressFormatIndex.js'
import { Core, Utils } from '../nidavellir'
import { reverseHexString } from '../utils.js'
import { fromBaseString, toScript } from './address.js'

const { KeyRing } = bcoin.primitives
const Script = bcoin.script

const { MTX, Coin, TX } = bcoin.primitives

const witScale = 4
const RBF_SEQUENCE_NUM = 0xffffffff - 2

export const sumUtxos = (utxos: Array<Utxo>) =>
  utxos.reduce((s, { tx, index }) => s + parseInt(tx.outputs[index].value), 0)

export const createTX = async ({
  utxos,
  outputs = [],
  changeAddress,
  rate,
  maxFee,
  height = -1,
  estimate,
  network,
  txOptions: {
    selection = 'value',
    RBFraw = '',
    CPFP = '',
    CPFPlimit = 1,
    subtractFee = false,
    setRBF = false
  }
}: CreateTxOptions) => {
  const { serializers } = Core.Networks[network]

  // Create the Mutable Transaction
  const mtx = new MTX()

  // Check for CPFP condition
  if (CPFP !== '') {
    utxos = utxos.filter(({ tx }) => tx.txid() === CPFP)
    // If not outputs are given try and build the most efficient TX
    if (!mtx.outputs || mtx.outputs.length === 0) {
      // Sort the UTXOs by size
      utxos = utxos.sort(
        (a, b) =>
          parseInt(b.tx.outputs[b.index]) - parseInt(a.tx.outputs[a.index])
      )
      // Try and get only the biggest UTXO unless the limit is 0 which means take all
      if (CPFPlimit) utxos = utxos.slice(0, CPFPlimit)
      // CPFP transactions will try to not have change
      // by subtracting moving all the value from the UTXOs
      // and subtracting the fee from the total output value
      const value = sumUtxos(utxos)
      subtractFee = true
      // CPFP transactions will add the change address as a single output
      outputs.push({ address: changeAddress, value })
    }
  }

  if (outputs.length === 0) {
    throw new Error('No outputs available.')
  }

  // Add the outputs
  outputs.forEach(async ({ address, value }) => {
    const addressScript = toScript(fromBaseString(address, network))
    mtx.addOutput(addressScript, value)
  })

  // Create coins
  const coins = utxos.map(({ tx, index, height }) => {
    const coin = Coin.fromTX(tx, index, height)
    coin.hash = serializers.txHash(tx.toNormal().toString('hex'))
    return coin
  })

  changeAddress = toBitcoinFormat(changeAddress, network)

  // Try to fund the transaction
  await mtx.fund(coins, {
    selection,
    changeAddress,
    subtractFee,
    height,
    rate,
    maxFee,
    estimate
  })

  // If TX is RBF mark is by changing the Inputs sequences
  if (setRBF) {
    for (const input of mtx.inputs) {
      input.sequence = RBF_SEQUENCE_NUM
    }
  }

  // Check consensus rules for fees and outputs
  if (!mtx.isSane()) {
    throw new Error('TX failed sanity check.')
  }

  // Check consensus rules for inputs
  if (height !== -1 && !mtx.verifyInputs(height)) {
    throw new Error('TX failed context check.')
  }

  return mtx
}

export const verifyTxAmount = (
  rawTx: string,
  bcoinTx: any = TX.fromRaw(rawTx, 'hex')
) =>
  filterOutputs(bcoinTx.outputs).find(({ value }) => parseInt(value) <= 0)
    ? false
    : bcoinTx

export const parseTransaction = (rawTx: string, bcoinTx?: Object): Object => {
  if (!bcoinTx) bcoinTx = TX.fromRaw(rawTx, 'hex')
  bcoinTx.outputs.forEach(output => {
    const outputHex = output.script.toRaw().toString('hex')
    const scriptHash = Utils.Hash.sha256(outputHex)
    output.scriptHash = reverseHexString(scriptHash)
  })
  return bcoinTx
}

// Creates a Bcoin Transaction instance from a static JSON object
export const parseJsonTransaction = (txJson: Object): Object => {
  // Create a bcoin transaction instance. At this stage it WON'T contain the utxo information for the inputs
  const bcoinTx = MTX.fromJSON(txJson)
  // Import all the 'coins' (utxos) from txJson
  for (const input of txJson.inputs) {
    // Create a bcoin Coin Object from the input's coin and prevout
    const opts = Object.assign({}, input.coin, input.prevout)
    const bcoinCoin = Coin.fromJSON(opts)
    // Add the `Coin` (UTXO) to the transaction's view (where a bcoin TX/MTX Object keeps it's `Coins`)
    bcoinTx.view.addCoin(bcoinCoin)
  }
  return bcoinTx
}

export const sumTransaction = (
  bcoinTransaction: any,
  network: string,
  engineState: any
) => {
  const ourReceiveAddresses = []
  let totalOutputAmount = 0
  let totalInputAmount = 0
  let nativeAmount = 0
  let output = null
  let type = null
  // Process tx outputs
  const outputsLength = bcoinTransaction.outputs.length
  for (let i = 0; i < outputsLength; i++) {
    output = bcoinTransaction.outputs[i]
    type = output.getType()
    if (type === 'nonstandard' || type === 'nulldata') {
      continue
    }
    const { value } = output.getJSON(network)
    totalOutputAmount += value
    const addressInfo = engineState.addressInfos[output.scriptHash]
    if (addressInfo) {
      nativeAmount += value
      ourReceiveAddresses.push(addressInfo.displayAddress)
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
        const output = prevoutBcoinTX.outputs[index]
        const { value } = output.getJSON(network)
        totalInputAmount += value
        const addressInfo = engineState.addressInfos[output.scriptHash]
        if (addressInfo) {
          nativeAmount -= value
        }
      }
    }
  }

  const fee = totalInputAmount ? totalInputAmount - totalOutputAmount : 0
  return { nativeAmount, fee, ourReceiveAddresses }
}

export const filterOutputs = (outputs: Array<any>): Array<any> =>
  outputs.filter(output => {
    const type = output.getType()
    return type !== 'nonstandard' && type !== 'nulldata'
  })

export const getReceiveAddresses = (
  bcoinTx: Object,
  network: string
): Array<string> =>
  filterOutputs(bcoinTx.outputs).map(output => {
    const address = output.getAddress().toString(network)
    return toNewFormat(address, network)
  })

export const sign = async (
  tx: any,
  keys: KeyRings,
  network: string
): Promise<{ txid: string, signedTx: string }> => {
  const keyRings = keys.map(
    ({ privateKey, publicKey, redeemScript, scriptType }) =>
      KeyRing.fromOptions({
        network,
        key: Buffer.from(privateKey || publicKey, 'hex'),
        nested: scriptType === 'P2WPKH-P2SH',
        witness: scriptType.includes('P2WPKH'),
        script: redeemScript && Script.fromString(redeemScript),
        compressed:
          publicKey.length === 66 &&
          publicKey[0] === '0' &&
          (publicKey[1] === '2' || publicKey[1] === '3')
      })
  )
  await tx.template(keyRings)
  tx.network = network
  await tx.sign(keyRings, Core.Networks[network].replayProtection)
  const { serializers } = Core.Networks[network]
  const txHash = serializers.txHash(tx.toNormal().toString('hex'))
  const txid = reverseHexString(txHash)
  return { txid, signedTx: tx.toRaw().toString('hex') }
}

export const estimateSize = (scriptType: string, prev: any) => {
  const address = prev.getAddress()
  if (!address) return -1

  let size = 0

  if (
    scriptType === 'P2WPKH' ||
    (prev.isScripthash() && scriptType === 'P2WPKH-P2SH')
  ) {
    size += 23 // redeem script
    size *= 4 // vsize
    // Varint witness items length.
    size += 1
    // Calculate vsize
    size = ((size + witScale - 1) / witScale) | 0
    // witness portion
    // OP_PUSHDATA0 [signature]
    let witness = 1 + 73
    // OP_PUSHDATA0 [key]
    witness += 1 + 33
    size += witness / witScale
  }

  // P2PKH
  if (scriptType !== 'P2WPKH-P2SH') {
    // varint script size
    size += 1
    // OP_PUSHDATA0 [signature]
    size += 1 + 73
    // OP_PUSHDATA0 [key]
    size += 1 + 33
  }

  return size || -1
}
