// @flow
// $FlowFixMe
import buffer from 'buffer-hack'
import { hd, primitives, consensus, network as Network } from 'bcoin'
import { addressToScriptHash, setKeyType } from '../utils/coinUtils.js'

// $FlowFixMe
const { Buffer } = buffer
const witScale = consensus.WITNESS_SCALE_FACTOR

export const getAllAddresses = (
  privateKeys: Array<string>,
  network: string
) => {
  const addressesPromises = []
  for (const bip of SUPPORTED_BIPS) {
    for (const key of privateKeys) {
      const dSelector = FormatSelector(bip, network)
      addressesPromises.push(dSelector.addressFromSecret(key))
    }
  }
  return Promise.all(addressesPromises)
}

export const SUPPORTED_BIPS = ['bip32', 'bip44', 'bip49', 'bip84']

export const FormatSelector = (
  bipStr: string = 'bip32',
  network: string = 'main'
) => {
  if (!SUPPORTED_BIPS.includes(bipStr)) throw new Error('Unknown bip type')
  const bip = parseInt(bipStr.split('bip')[1])

  const branches = ['master', 'receive']
  if (bip !== 32) branches.push('change')
  const nested = bip === 49
  const witness = bip === 49 || bip === 84

  const setKeyTypeWrap = (key: any) => setKeyType(key, nested, witness, network)
  const addressFromKey = (key: any) =>
    setKeyTypeWrap(key).then(key => {
      const address = key.getAddress().toString()
      return addressToScriptHash(address).then(scriptHash => ({
        address,
        scriptHash
      }))
    })

  return {
    addressFromKey,
    branches: branches.slice(1),
    setKeyType: setKeyTypeWrap,

    addressFromSecret: (key: any): Promise<any> => Promise
      .resolve(primitives.KeyRing.fromSecret(key, network))
      .then(keyObj => addressFromKey(keyObj)),

    parseSeed:
      bip === 32
        ? (seed: string) => Buffer.from(seed, 'base64').toString('hex')
        : (seed: string) => seed,

    createMasterPath: (account: number, coinType: number) =>
      bip === 32
        ? 'm/0'
        : `m/${bip}'/${
          coinType >= 0 ? coinType : Network.get(network).keyPrefix.coinType
        }'/${account}'`,

    deriveAddress: (parentKey: any, index: number): Promise<any> =>
      Promise.resolve(parentKey.derive(index)).then(key => addressFromKey(key)),

    deriveKeyRing: (parentKey: any, index: number): Promise<any> =>
      Promise.resolve(parentKey.derive(index)).then(derivedKey =>
        setKeyTypeWrap(derivedKey)
      ),

    keysFromRaw: (rawKeys: any = {}) =>
      branches.reduce((keyRings, branch) => {
        const { xpub, xpriv } = rawKeys[branch] || {}
        return {
          ...keyRings,
          [branch]: {
            pubKey: xpub ? hd.PublicKey.fromBase58(xpub, network) : null,
            privKey: xpriv ? hd.PrivateKey.fromBase58(xpriv, network) : null,
            children: []
          }
        }
      }, {}),

    estimateSize: (prev: any) => {
      const address = prev.getAddress()
      if (!address) return -1

      let size = 0

      if (prev.isScripthash()) {
        if (bip === 49) {
          size += 23 // redeem script
          size *= 4 // vsize
          // Varint witness items length.
          size += 1
          // Calculate vsize
          size = ((size + witScale - 1) / witScale) | 0
        }
      }

      // P2PKH
      if (bip !== 49) {
        // varint script size
        size += 1
        // OP_PUSHDATA0 [signature]
        size += 1 + 73
        // OP_PUSHDATA0 [key]
        size += 1 + 33
      }

      return size || -1
    }
  }
}
