// @flow
// $FlowFixMe
import buffer from 'buffer-hack'
import { utils, hd, primitives, script, network as Network } from 'bcoin'
import { hash256, hash256Sync, reverseBufferToHex } from './utils.js'

// $FlowFixMe
const { Buffer } = buffer

export type BlockHeight = number

export type Utxo = {
  index: number,
  tx: any,
  height: BlockHeight
}

export const keysFromWalletInfo = (
  network: string,
  { keys = {}, type }: any = {}, // walletInfo
  { master = {}, ...otherKeys }: any = {} // cachedRawKeys
) => ({
  seed: keys[`${network}Key`] || '',
  coinType: typeof keys.coinType === 'number' ? keys.coinType : -1,
  rawKeys: {
    ...otherKeys,
    master: {
      ...master,
      xpub: master.xpub || keys[`${network}Xpub`]
    }
  },
  bip:
    typeof keys.format === 'string'
      ? keys.format
      : typeof type === 'string' ? type.split('-')[1] : ''
})

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
    primitives.KeyRing.fromOptions({ ...key, nested, witness })
  ).then(clone => Object.assign(clone, { network: Network.get(network) }))

export const getPrivateFromSeed = async (seed: string, network: string) => {
  try {
    const mnemonic = hd.Mnemonic.fromPhrase(seed)
    return hd.PrivateKey.fromMnemonic(mnemonic, network)
  } catch (e) {
    console.log('Not a mnemonic, treating the seed as base64')
    return hd.PrivateKey.fromSeed(Buffer.from(seed, 'base64'), network)
  }
}

export const addressToScriptHash = (address: string): Promise<string> =>
  Promise.resolve(script.fromAddress(address).toRaw())
    .then(scriptRaw => hash256(scriptRaw))
    .then(scriptHashRaw => reverseBufferToHex(scriptHashRaw))

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

export const parsePath = (path: string = '', masterPath: string) =>
  (path.split(`${masterPath}`)[1] || '')
    .split('/')
    .filter(i => i !== '')
    .map(i => parseInt(i))

export const sumUtxos = (utxos: Array<Utxo>) =>
  utxos.reduce((s, { tx, index }) => s + parseInt(tx.outputs[index].value), 0)
