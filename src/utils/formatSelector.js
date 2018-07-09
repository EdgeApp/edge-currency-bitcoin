// @flow
// $FlowFixMe
import buffer from 'buffer-hack'
import { hd, primitives, consensus, network as Network } from 'bcoin'
import { getPrivateFromSeed, addressToScriptHash, setKeyType } from '../utils/coinUtils.js'

export const SUPPORTED_BIPS = ['bip32', 'bip44', 'bip49', 'bip84']

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
      const fSelector = FormatSelector(bip, network)
      addressesPromises.push(
        fSelector.keyFromSecret(key).then(fSelector.addressFromKey)
      )
    }
  }
  return Promise.all(addressesPromises)
}

export const getXPubFromSeed = async ({
  seed,
  bip = 'bip32',
  network = 'main',
  account = 0,
  coinType = 0
}: any) => {
  const masterKey = await getPrivateFromSeed(seed, network)
  const fSelector = FormatSelector(bip, network)
  const masterPath = fSelector.createMasterPath(0, coinType)
  const privateKey = await masterKey.derivePath(masterPath)
  return privateKey.xpubkey()
}

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
  const deriveHdKey = (parentKey: any, index: number): Promise<any> =>
    Promise.resolve(parentKey.derive(index))
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

    sign: (tx: any, keys: Array<any>): Promise<{txid: string, signedTx: string}> =>
      Promise.resolve(tx.template(keys))
        .then(() => tx.sign(keys, Network.get(network).replayProtection))
        .then(() => ({
          txid: tx.rhash(),
          signedTx: tx.toRaw().toString('hex')
        })),

    getMasterKeys: async (seed: string, masterPath: string, privKey?: any) => {
      if (!privKey) {
        const privateKey = await getPrivateFromSeed(seed, network)
        privKey = await privateKey.derivePath(masterPath)
      }
      return { privKey, pubKey: privKey.toPublic() }
    },

    keyFromSecret: (key: any): Promise<any> =>
      Promise.resolve(primitives.KeyRing.fromSecret(key, network)),

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

    deriveHdKey,
    deriveAddress: (parentKey: any, index: number): Promise<any> =>
      deriveHdKey(parentKey, index).then(key => addressFromKey(key)),

    deriveKeyRing: (parentKey: any, index: number): Promise<any> =>
      deriveHdKey(parentKey, index).then(derivedKey => setKeyTypeWrap(derivedKey)),

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
