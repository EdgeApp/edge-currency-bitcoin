// @flow
import type { Utxo, CreateTxOptions } from './types.js'
import { consensus, primitives, script, networks } from 'bcoin'
import { hash256Sync, reverseBufferToHex } from '../utils.js'
import { getNetworkSettings } from './misc.js'
import {
  toLegacyFormat,
  toNewFormat
} from '../addressFormat/addressFormatIndex.js'

const witScale = consensus.WITNESS_SCALE_FACTOR
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
  const { addressPrefix, serializers } = getNetworkSettings(network)
  // Convert an address to the correct format that bcoin supports
  const toBcoinFormat = (address: string, network: string): string => {
    if (serializers.address) address = serializers.address.decode(address)
    else if (addressPrefix.cashAddress) {
      address = toLegacyFormat(address, network)
    } else address = toNewFormat(address, network)
    return primitives.Address.fromString(address, network)
  }

  // Create the Mutable Transaction
  const mtx = new primitives.MTX()

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
  outputs.forEach(({ address, value }) => {
    const bcoinAddress = toBcoinFormat(address, network)
    const addressScript = script.fromAddress(bcoinAddress)
    mtx.addOutput(addressScript, value)
  })

  // Create coins
  const coins = utxos.map(({ tx, index, height }) => {
    const coin = primitives.Coin.fromTX(tx, index, height)
    if (serializers.txHash) {
      coin.hash = serializers.txHash(tx.toNormal().toString('hex'))
    }
    return coin
  })

  // Try to fund the transaction
  await mtx.fund(coins, {
    selection,
    changeAddress: toBcoinFormat(changeAddress, network),
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
  bcoinTx: any = primitives.TX.fromRaw(rawTx, 'hex')
) =>
  filterOutputs(bcoinTx.outputs).find(({ value }) => parseInt(value) <= 0)
    ? false
    : bcoinTx

export const parseTransaction = (
  rawTx: string,
  bcoinTx: any = primitives.TX.fromRaw(rawTx, 'hex')
) =>
  !bcoinTx.outputs.forEach(output => {
    output.scriptHash = reverseBufferToHex(hash256Sync(output.script.toRaw()))
  }) && bcoinTx

// Creates a Bcoin Transaction instance from a static JSON object
export const parseJsonTransaction = (txJson: Object): Object => {
  // Create a bcoin transaction instance. At this stage it WON'T contain the utxo information for the inputs
  const bcoinTx = primitives.MTX.fromJSON(txJson)
  // Import all the 'coins' (utxos) from txJson
  for (const input of txJson.inputs) {
    // Create a bcoin Coin Object from the input's coin and prevout
    const opts = Object.assign({}, input.coin, input.prevout)
    const bcoinCoin = primitives.Coin.fromJSON(opts)
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
  let address = ''
  let value = 0
  let output = null
  let type = null
  const { serializers } = getNetworkSettings(network)
  // Process tx outputs
  const outputsLength = bcoinTransaction.outputs.length
  for (let i = 0; i < outputsLength; i++) {
    output = bcoinTransaction.outputs[i]
    type = output.getType()
    if (type === 'nonstandard' || type === 'nulldata') {
      continue
    }
    output = output.getJSON(network)
    value = output.value
    try {
      address = toNewFormat(output.address, network)
      address = serializers.address
        ? serializers.address.encode(address)
        : address
    } catch (e) {
      console.log(e)
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

export const sign = (
  tx: any,
  keys: Array<any>,
  network: string
): Promise<{ txid: string, signedTx: string }> =>
  Promise.resolve(tx.template(keys))
    .then(() => {
      tx.network = network
      return tx.sign(keys, networks[network].replayProtection)
    })
    .then(() => {
      const { serializers } = getNetworkSettings(network)
      if (serializers.txHash) {
        tx._hash = serializers.txHash(tx.toNormal().toString('hex'))
      }
      const txid = tx.rhash()
      return { txid, signedTx: tx.toRaw().toString('hex') }
    })

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
