// @flow
import { hash256, reverseBufferToHex } from '../utils.js'
import { primitives, script } from 'bcoin'
import { getAllKeyRings } from './key.js'
import { getNetworkSettings } from './misc.js'

export const addressToScriptHash = (
  address: string,
  network: string
): Promise<string> => {
  const addressObj = primitives.Address.fromString(address, network)
  return Promise.resolve(script.fromAddress(addressObj).toRaw())
    .then(scriptRaw => hash256(scriptRaw))
    .then(scriptHashRaw => reverseBufferToHex(scriptHashRaw))
}

export const addressFromKey = async (
  key: any,
  network: string
): Promise<{ address: string, scriptHash: string }> => {
  const { serializers } = getNetworkSettings(network)
  const standardAddress = key.getAddress().toString()
  let address = standardAddress
  if (serializers.address) address = serializers.address.encode(address)
  const scriptHash = await addressToScriptHash(standardAddress, network)
  return {
    address,
    scriptHash
  }
}

export const getAllAddresses = (
  privateKeys: Array<string>,
  network: string
): Promise<any[]> =>
  getAllKeyRings(privateKeys, network).then(keyRings =>
    Promise.all(keyRings.map(key => addressFromKey(key, network)))
  )
