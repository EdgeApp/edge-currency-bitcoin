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
import { FormatSelector } from '../../../src/utils/formatSelector.js'
import { describe, it } from 'mocha'
import { expect, assert } from 'chai'
import { primitives } from 'bcoin'
// eslint-disable-next-line no-unused-vars
import * as Factories from '../../../src/index'
import fixtures from './fixtures.json'

for (const fixture of fixtures) {
  const { network, pluginName, coinType, format } = fixture

  describe('getReceiveAddresses', function () {
    fixture['addressesRawTxs'].forEach(tx => {
      it('Test getReceiveAddresses', async function () {
        const bcoinTx: any = primitives.TX.fromRaw(tx.raw, 'hex')
        const address = await getReceiveAddresses(bcoinTx, network)
        assert.equal(address[0], tx.expectedAddress)
      })
    })
  })

  describe('isCompressed', function () {
    fixture['compressedkeys'].forEach(key => {
      it('Check if key is compressed', function () {
        const compressed: boolean = isCompressed(Buffer.from(key, 'hex'))
        assert(compressed, 'Key is not compressed')
      })
    })
  })

  describe('isCompressed', function () {
    fixture['unCompressedkeys'].forEach(key => {
      it('Check if key is un compressed', function () {
        const unCompressed: boolean = isCompressed(Buffer.from(key, 'hex'))
        assert(!unCompressed, 'Key is compressed')
      })
    })
  })

  describe('verifyWIF', function () {
    fixture['WIF'].forEach(wifKey => {
      it('Verify WIF format', function () {
        const isWif: boolean = verifyWIF(wifKey, network)
        assert(isWif, 'key is not wif')
      })
    })
  })

  describe('addressToScriptHash', function () {
    fixture['scriptHashAddresses'].forEach(addressToScript => {
      it('Test addressToScriptHash', async function () {
        const scriptHash = await addressToScriptHash(
          addressToScript.address,
          network
        )
        assert.equal(scriptHash, addressToScript.expectedScriptHash)
      })
    })
  })

  describe('verifyUriProtocol', function () {
    fixture['URIs'].forEach(uri => {
      it('Verify URI format', function () {
        const protocol: boolean = verifyUriProtocol(
          uri.protocol,
          network,
          pluginName
        )
        assert(protocol, 'protocol not verified')
      })
    })
  })

  describe('getPrivateFromSeed', function () {
    fixture['seedToXpriv'].forEach(key => {
      it('Verify Private From Seed', async function () {
        const resKey = await getPrivateFromSeed(key.seed, network)
        assert.equal(resKey.xprivkey(), key.xpriv)
      })
    })
  })

  describe('keysFromEntropy', function () {
    fixture['entropyKeys'].forEach(key => {
      const randomBuffer = Buffer.from(key.entropy, 'hex')
      it('Test keysFromEntropy', function () {
        const opts = { format, coinType }
        const res = keysFromEntropy(randomBuffer, network, opts)
        assert.equal(res[network + 'Key'], key.seed)
        assert.equal(res.format, format)
        assert.equal(res.coinType, coinType)
      })
    })
  })

  describe('createTx', function () {
    fixture['createTx'].forEach(txData => {
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
      const estimate = prev => FormatSelector.estimateSize(prev)
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
    fixture['parseTx'].forEach(txData => {
      it('Matches a known transaction', function () {
        const parsedData = parseTransaction(txData.rawTx)
        for (let index = 0; index < parsedData.inputs.length; index++) {
          expect(parsedData.inputs[index].prevout.rhash()).to.equal(
            txData.expected.inputs[index].txid
          )
          expect(parsedData.inputs[index].prevout.index).to.equal(
            txData.expected.inputs[index].index
          )
        }
        for (let index = 0; index < parsedData.outputs.length; index++) {
          expect(parsedData.outputs[index].scriptHash).to.equal(
            txData.expected.outputs[index].scriptHash
          )
          expect(parsedData.outputs[index].value).to.equal(
            txData.expected.outputs[index].value
          )
        }
      })
    })
  })
}
