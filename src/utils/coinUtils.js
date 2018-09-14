// @flow
// $FlowFixMe
import buffer from 'buffer-hack'
import {
  utils,
  hd,
  primitives,
  script,
  networks,
  network as Network
} from 'bcoin'
import { hash256, hash256Sync, reverseBufferToHex } from './utils.js'
import {
  toLegacyFormat,
  toNewFormat
} from './addressFormat/addressFormatIndex.js'

const { Buffer } = buffer
const RBF_SEQUENCE_NUM = 0xffffffff - 2

export type RawTx = string
export type BlockHeight = number
export type Txid = string

export type Output = {
  address: string,
  value: number
}

export type Utxo = {
  tx: any,
  index: number,
  height?: BlockHeight
}

export type TxOptions = {
  utxos?: Array<Utxo>,
  setRBF?: boolean,
  RBFraw?: RawTx,
  CPFP?: Txid,
  CPFPlimit?: number,
  selection?: string,
  subtractFee?: boolean
}

export type CreateTxOptions = {
  utxos: Array<Utxo>,
  rate: number,
  maxFee: number,
  changeAddress: string,
  network: string,
  outputs?: Array<Output>,
  height?: BlockHeight,
  estimate?: Function,
  txOptions: TxOptions
}

export const isCompressed = (key: any): boolean =>
  Buffer.isBuffer(key) &&
  key.length === 33 &&
  (key[0] === 0x02 || key[0] === 0x03)

export const keysFromEntropy = (
  entropy: Buffer,
  network: string,
  opts: any = {}
) => {
  const { formats = [], keyPrefix = {} } = networks[network] || {}
  return {
    [`${network}Key`]: hd.Mnemonic.fromEntropy(entropy).getPhrase(),
    format: opts.format || formats[0] || 'bip44',
    coinType: opts.coinType || keyPrefix.coinType || 0
  }
}

export const verifyWIF = (data: any, network: string) => {
  const base58 = utils.base58
  const br = new utils.BufferReader(base58.decode(data), true)
  const version = br.readU8()
  network = Network.fromWIF(version, network)
  br.readBytes(32)
  if (br.left() > 4 && br.readU8() !== 1) {
    throw new Error('Bad compression flag.')
  }
  br.verifyChecksum()
  return true
}

export const setKeyType = (
  key: any,
  nested: boolean,
  witness: boolean,
  network: string
): Promise<any> =>
  Promise.resolve(
    primitives.KeyRing.fromKey(
      key.privateKey || key.publicKey,
      isCompressed(key.publicKey),
      network
    )
  ).then(clone =>
    Object.assign(clone, { nested, witness, network: Network.get(network) })
  )

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

  // Convert an address to the correct format that bcoin supports
  const toBcoinFormat = (address: string, network: string): string => {
    const { addressPrefix = {} } = networks[network] || {}
    return addressPrefix.cashAddress
      ? toLegacyFormat(address, network)
      : toNewFormat(address, network)
  }

  // Add the outputs
  outputs.forEach(({ address, value }) => {
    const bcoinAddress = toBcoinFormat(address, network)
    const addressObj = primitives.Address.fromString(bcoinAddress, network)
    const addressScript = script.fromAddress(addressObj)
    mtx.addOutput(addressScript, value)
  })

  // Create coins
  const coins = utxos.map(({ tx, index, height }) =>
    primitives.Coin.fromTX(tx, index, height)
  )

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

export const getPrivateFromSeed = async (seed: string, network: string) => {
  try {
    const mnemonic = hd.Mnemonic.fromPhrase(seed)
    return hd.PrivateKey.fromMnemonic(mnemonic, network)
  } catch (e) {
    console.log('Not a mnemonic, treating the seed as base64')
    return hd.PrivateKey.fromSeed(Buffer.from(seed, 'base64'), network)
  }
}

export const addressToScriptHash = (
  address: string,
  network: string
): Promise<string> => {
  const addressObj = primitives.Address.fromString(address, network)
  return Promise.resolve(script.fromAddress(addressObj).toRaw())
    .then(scriptRaw => hash256(scriptRaw))
    .then(scriptHashRaw => reverseBufferToHex(scriptHashRaw))
}

export const verifyTxAmount = (
  rawTx: string,
  bcoinTx: any = primitives.TX.fromRaw(rawTx, 'hex')
) =>
  bcoinTx.outputs.find(({ value }) => parseInt(value) <= 0) ? false : bcoinTx

export const parseTransaction = (
  rawTx: string,
  bcoinTx: any = primitives.TX.fromRaw(rawTx, 'hex')
) =>
  !bcoinTx.outputs.forEach(output => {
    output.scriptHash = reverseBufferToHex(hash256Sync(output.script.toRaw()))
  }) && bcoinTx

export const parsePath = (
  path: string = '',
  masterPath: string
): Array<number> =>
  (path.split(`${masterPath}`)[1] || '')
    .split('/')
    .filter(i => i !== '')
    .map(i => parseInt(i))

export const sumUtxos = (utxos: Array<Utxo>) =>
  utxos.reduce((s, { tx, index }) => s + parseInt(tx.outputs[index].value), 0)

export const getLock = () => new utils.Lock()

export const getForksForNetwork = (network: string) =>
  networks[network] && networks[network].forks ? networks[network].forks : []

export const getFromatsForNetwork = (network: string) =>
  networks[network] ? networks[network].formats : []

export const addressFromKey = (key: any, network: string): Promise<any> => {
  const address = key.getAddress().toString()
  return addressToScriptHash(address, network).then(scriptHash => ({
    address,
    scriptHash
  }))
}
