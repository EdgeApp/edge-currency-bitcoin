// @flow
import {
  parseTransaction,
  isCompressed,
  verifyWIF,
  verifyUriProtocol,
  keysFromEntropy,
  createTX,
  getPrivateFromSeed,
  addressToScriptHash,
  getReceiveAddresses
} from '../../../src/utils/coinUtils.js'

import type { CreateTxOptions } from '../../../src/utils/coinUtils.js'
import {
  estimateSize,
  getDerivationConfiguration
} from '../../../src/utils/formatSelector.js'
import { describe, it } from 'mocha'
import { expect, assert } from 'chai'
import { primitives } from 'bcoin'
// eslint-disable-next-line no-unused-vars
import * as Factories from '../../../src/index'
import fixtures from './fixtures.json'

for (const fixture of fixtures) {
  describe('getReceiveAddresses', function () {
    fixture['addressesRawTxs'].forEach(([network, raw, expectedAddress]) => {
      it('Test getReceiveAddresses', async function () {
        const bcoinTx: any = primitives.TX.fromRaw(raw, 'hex')
        const address = await getReceiveAddresses(bcoinTx, network)
        assert.equal(address[0], expectedAddress)
      })
    })
  })

  describe('isCompressed', function () {
    fixture['compressedkeys'].forEach(([network, key]) => {
      it('Check if key is compressed', function () {
        const compressed: boolean = isCompressed(Buffer.from(key, 'hex'))
        assert(compressed, 'Key is not compressed')
      })
    })
  })

  describe('isCompressed', function () {
    fixture['unCompressedkeys'].forEach(([network, key]) => {
      it('Check if key is un compressed', function () {
        const unCompressed: boolean = isCompressed(Buffer.from(key, 'hex'))
        assert(!unCompressed, 'Key is compressed')
      })
    })
  })

  describe('verifyWIF', function () {
    fixture['WIF'].forEach(([network, wifKey]) => {
      it('Verify WIF format', function () {
        const isWif: boolean = verifyWIF(wifKey, network)
        assert(isWif, 'key is not wif')
      })
    })
  })

  describe('addressToScriptHash', function () {
    fixture['scriptHashAddresses'].forEach(
      ([network, address, expectedScriptHash]) => {
        it('Test addressToScriptHash', async function () {
          const scriptHash = await addressToScriptHash(address, network)
          assert.equal(scriptHash, expectedScriptHash)
        })
      }
    )
  })

  describe('verifyUriProtocol', function () {
    fixture['URIs'].forEach(([network, protocol, pluginName]) => {
      it('Verify URI format', function () {
        const protocolRes: boolean = verifyUriProtocol(
          protocol,
          network,
          pluginName
        )
        assert(protocolRes, 'protocol not verified')
      })
    })
  })

  describe('getPrivateFromSeed', function () {
    fixture['seedToXpriv'].forEach(([network, seed, xpriv]) => {
      it('Verify Private From Seed', async function () {
        const resKey = await getPrivateFromSeed(seed, network)
        assert.equal(resKey.xprivkey(), xpriv)
      })
    })
  })

  describe('keysFromEntropy', function () {
    fixture['entropyKeys'].forEach(
      ([network, coinType, format, entropy, seed]) => {
        const randomBuffer = Buffer.from(entropy, 'hex')
        it('Test keysFromEntropy', function () {
          const opts = { format, coinType }
          const res = keysFromEntropy(randomBuffer, network, opts)
          assert.equal(res[network + 'Key'], seed)
          assert.equal(res.format, format)
          assert.equal(res.coinType, coinType)
        })
      }
    )
  })

  describe('createTx', function () {
    fixture['createTx'].forEach(([bip, network, txData]) => {
      const utxos = []
      txData.utxos.forEach(utxo => {
        utxos.push({
          index: utxo.index,
          tx: primitives.TX.fromRaw(utxo.rawTx, 'hex'),
          height: utxo.height
        })
      })
      const outputs = []
      txData.outputs.forEach(output => {
        outputs.push({ address: output.address, value: output.value })
      })
      const config = getDerivationConfiguration(bip, network)
      const estimate = prev => estimateSize(config, prev)
      const txOpts: CreateTxOptions = {
        utxos,
        outputs,
        changeAddress: txData.changeAddress,
        rate: txData.rate,
        maxFee: txData.rate,
        height: txData.rate,
        estimate,
        network,
        txOptions: {
          selection: 'value',
          RBFraw: '',
          CPFP: '',
          CPFPlimit: 1,
          subtractFee: false,
          setRBF: false
        }
      }
      it('Test createTx', async function () {
        const tx = await createTX(txOpts)
        // console.log(tx.toJSON())
        assert.equal(tx.toJSON().hash, txData.hash)
        assert.equal(tx.toJSON().hex, txData.hex)
      })
    })
  })

  describe('parseTransaction', function () {
    fixture['parseTx'].forEach(([rawTx, expected]) => {
      it('Matches a known transaction', function () {
        const parsedData = parseTransaction(rawTx)
        for (let index = 0; index < parsedData.inputs.length; index++) {
          expect(parsedData.inputs[index].prevout.rhash()).to.equal(
            expected.inputs[index].txid
          )
          expect(parsedData.inputs[index].prevout.index).to.equal(
            expected.inputs[index].index
          )
        }
        for (let index = 0; index < parsedData.outputs.length; index++) {
          expect(parsedData.outputs[index].scriptHash).to.equal(
            expected.outputs[index].scriptHash
          )
          expect(parsedData.outputs[index].value).to.equal(
            expected.outputs[index].value
          )
        }
      })
    })
  })
}
