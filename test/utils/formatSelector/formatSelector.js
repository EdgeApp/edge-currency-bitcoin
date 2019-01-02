// @flow
import {
  getDerivationConfiguration,
  getXPubFromSeed,
  getAllAddresses,
  getAllKeyRings,
  deriveHdKey,
  // sign,
  getMasterKeys,
  parseSeed,
  deriveAddress,
  deriveKeyRing,
  deriveScriptAddress,
  keysFromRaw
} from '../../../src/utils/formatSelector.js'

import type { DerivationConfig } from '../../../src/utils/coinUtils.js'

import { describe, it } from 'mocha'
import { assert } from 'chai'
import { hd } from 'bcoin'
// eslint-disable-next-line no-unused-vars
import * as Factories from '../../../src/index'
import fixtures from './fixtures.json'

for (const fixture of fixtures) {
  describe('Format selector getDerivationConfiguration', function () {
    fixture['derivationConfiguration'].forEach(([network, bip, expectedConfig]) => {
      it('Test getDerivationConfiguration', function () {
        const config: DerivationConfig = getDerivationConfiguration(bip, network)
        assert.equal(config.nested, expectedConfig.nested)
        assert.equal(config.witness, expectedConfig.witness)
        // assert.equal(config.branches, expectedConfig.branches)
        assert.equal(config.network, expectedConfig.network)
        assert.equal(config.bip, expectedConfig.bip)
        // assert.equal(config.scriptTemplates, expectedConfig.scriptTemplates)
      })
    })
  })

  describe('Format selector getXPubFromSeed', function () {
    fixture['pubFromSeed'].forEach(([network, format, seed, account, coinType, expected]) => {
      it('Test getXPubFromSeed', async function () {
        const xpubKey = await getXPubFromSeed({ seed, network, account, format, coinType })
        assert.equal(xpubKey, expected)
      })
    })
  })

  describe('Format selector getAllKeyRings', function () {
    fixture['allKeyRings'].forEach(([network, keys, expected]) => {
      it('Test getAllKeyRings', async function () {
        const keyRings = await getAllKeyRings(keys, network)
        for (let index = 0; index < keyRings.length; index++) {
          assert.equal(keyRings[index].toJSON().address, expected[index].address)
          assert.equal(keyRings[index].toJSON().publicKey, expected[index].publicKey)
        }
      })
    })
  })

  describe('Format selector getAllAddresses', function () {
    fixture['allAddresses'].forEach(([network, keys, expected]) => {
      it('Test getAllAddresses', async function () {
        const addresses = await getAllAddresses(keys, network)
        for (let index = 0; index < addresses.length; index++) {
          assert.equal(addresses[index].address, expected[index].address)
          assert.equal(addresses[index].scriptHash, expected[index].scriptHash)
        }
      })
    })
  })

  describe('Format selector deriveHdKey', function () {
    fixture['deriveHdKey'].forEach(([network, xpriv, index, expected]) => {
      it('Test deriveHdKey', async function () {
        const bcoinKey = hd.PrivateKey.fromBase58(xpriv, network)
        const derivedKey = await deriveHdKey(bcoinKey, index)
        assert.equal(derivedKey.toBase58(network), expected)
      })
    })
  })

  // describe('Format selector sign', function () {
  //   fixture['signTxs'].forEach(([network, bip, raw]) => {
  //     it('Test sign', async function () {
  //       const config: DerivationConfig = getDerivationConfiguration(bip, network)
  //       // this is a test
  //       const key = primitives.keyRing.fromKey(Buffer, false, network)
  //       const bcoinTx: any = primitives.TX.fromRaw('010000000101820e2169131a77976cf204ce28685e49a6d2278861c33b6241ba3ae3e0a49f020000008b48304502210098a2851420e4daba656fd79cb60cb565bd7218b6b117fda9a512ffbf17f8f178022005c61f31fef3ce3f906eb672e05b65f506045a65a80431b5eaf28e0999266993014104f0f86fa57c424deb160d0fc7693f13fce5ed6542c29483c51953e4fa87ebf247487ed79b1ddcf3de66b182217fcaf3fcef3fcb44737eb93b1fcb8927ebecea26ffffffff02805cd705000000001976a91429d6a3540acfa0a950bef2bfdc75cd51c24390fd88ac80841e00000000001976a91417b5038a413f5c5ee288caa64cfab35a0c01914e88ac00000000', 'hex')
  //       const signed = await sign(config, bcoinTx, key)
  //       console.log(signed)
  //     })
  //   })
  // })

  describe('Format selector getMasterKeys', function () {
    fixture['masterKeys'].forEach(([network, bip, seed, masterPath, expected]) => {
      it('Test getMasterKeys', async function () {
        const config: DerivationConfig = getDerivationConfiguration(bip, network)
        const masterKeys = await getMasterKeys(config, seed, masterPath)
        assert.equal(masterKeys.privKey.toBase58(network), expected)
      })
    })
  })

  describe('Format selector parseSeed', function () {
    fixture['parseSeed'].forEach(([network, bip, seed, expected]) => {
      it('Test parseSeed', function () {
        const config: DerivationConfig = getDerivationConfiguration(bip, network)
        const parsedSeed = parseSeed(config)(seed)
        assert.equal(parsedSeed, expected)
      })
    })
  })

  describe('Format selector deriveAddress', function () {
    fixture['deriveAddress'].forEach(([network, bip, parentKey, index, expected]) => {
      it('Test deriveAddress', async function () {
        const config: DerivationConfig = getDerivationConfiguration(bip, network)
        const bcoinParentKey = hd.PrivateKey.fromBase58(parentKey, network)
        const address = await deriveAddress(config, bcoinParentKey, index)
        assert.equal(address.address, expected)
      })
    })
  })

  describe('Format selector deriveKeyRing', function () {
    fixture['deriveKeyRing'].forEach(([network, bip, parentKey, index, expected]) => {
      it('Test deriveKeyRing', async function () {
        const config: DerivationConfig = getDerivationConfiguration(bip, network)
        const bcoinParentKey = hd.PrivateKey.fromBase58(parentKey, network)
        const keyRing = await deriveKeyRing(config, bcoinParentKey, index)
        assert.equal(keyRing.toJSON().address, expected)
      })
    })
  })

  describe('Format selector deriveScriptAddress', function () {
    fixture['deriveScriptAddress'].forEach(([network, bip, parentKey, index, branch, expected]) => {
      it('Test deriveScriptAddress', async function () {
        const config: DerivationConfig = getDerivationConfiguration(bip, network)
        const bcoinParentKey = hd.PrivateKey.fromBase58(parentKey, network)
        const scriptAddress = await deriveScriptAddress(config, bcoinParentKey, index, branch)
        console.log('scriptAddress', scriptAddress)
        // assert.equal(scriptAddress.toJSON().address, expected)
      })
    })
  })

  describe('Format selector keysFromRaw', function () {
    fixture['keysFromRaw'].forEach(([network, bip, rawKeys, expected]) => {
      it('Test keysFromRaw', async function () {
        const config: DerivationConfig = getDerivationConfiguration(bip, network)
        const bcoinParentKey = hd.PrivateKey.fromRaw(rawKeys)
        const keys = await keysFromRaw(config, bcoinParentKey)
        console.log('keys', keys)
        // assert.equal(scriptAddress.toJSON().address, expected)
      })
    })
  })
}
