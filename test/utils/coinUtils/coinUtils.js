// @flow
import { parseTransaction, isCompressed, verifyWIF, verifyUriProtocol, keysFromEntropy, createTX } from '../../../src/utils/coinUtils.js'
import type { CreateTxOptions } from '../../../src/utils/coinUtils.js'
import { FormatSelector } from '../../../src/utils/formatSelector.js'
import { describe, it } from 'mocha'
import { expect, assert } from 'chai'
import { networks } from 'bcoin'
// eslint-disable-next-line no-unused-vars
import * as Factories from '../../../src/index'

describe('parseTransaction', function () {
  it('Matches a known transaction', function () {
    // txid 98b83856161f16f877194e0d80167bff0eb853fda89c2401ca2d99ee4676eca2
    const txData =
      '0100000001e7a4a70f71e090157bc7c1b47ee83af56beb3579d8fa24110a97d1ee717d9afb010000006b483045022100de863ece760a873d673851f9c81ed148519dfc237d3fd7d43600896d5c5ba651022003e1620cdbbca12596a34fc97495486eb3f8f523453cb031ac531d623af4c7430121038600604184c04d944cd711e08a903043961a8a01d32e738beec1937dea75ae35ffffffff0277060000000000001976a91491c5eab4339b77e897005c3fcf0c123c62fccf9988ac53150000000000001976a914f783b9f78fe45bae833babfa5f2ebf10dd0cb79788ac00000000'
    const expected = {
      inputs: [
        {
          txid:
            'fb9a7d71eed1970a1124fad87935eb6bf53ae87eb4c1c77b1590e0710fa7a4e7',
          index: 1
        }
      ],
      outputs: [
        {
          // displayAddress: '1EHn5KN3P71xTsZseTnNCRjfBhPCdw5To4'
          scriptHash:
            'b44600cd86fe9aa07b69417c81b8e59bd26a6965cba19882b9c7b001b98df1fa',
          value: 1655
        },
        {
          // displayAddress: '1PZjhtvQHmUgtoqcNTri7jn2NBq3d5QhBj'
          scriptHash:
            '052c80d8ec3d76cabca31765e54ee5bcce26125a459ce10f1775d0608f203463',
          value: 5459
        }
      ]
    }
    const parsedData = parseTransaction(txData)
    expect(parsedData.inputs[0].prevout.rhash()).to.equal(
      expected.inputs[0].txid
    )
    expect(parsedData.inputs[0].prevout.index).to.equal(
      expected.inputs[0].index
    )
    expect(parsedData.outputs[0].scriptHash).to.equal(
      expected.outputs[0].scriptHash
    )
    expect(parsedData.outputs[0].value).to.equal(expected.outputs[0].value)
    expect(parsedData.outputs[1].scriptHash).to.equal(
      expected.outputs[1].scriptHash
    )
    expect(parsedData.outputs[1].value).to.equal(expected.outputs[1].value)
  })

  it('Handles Bitcoin genesis transaction', function () {
    // txid 4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b
    const txData =
      '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000'
    const expected = {
      inputs: [
        {
          txid:
            '0000000000000000000000000000000000000000000000000000000000000000',
          index: 4294967295
        }
      ],
      outputs: [
        {
          // displayAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
          scriptHash:
            '740485f380ff6379d11ef6fe7d7cdd68aea7f8bd0d953d9fdf3531fb7d531833',
          value: 5000000000
        }
      ]
    }
    const parsedData = parseTransaction(txData)
    expect(parsedData.inputs[0].prevout.rhash()).to.equal(
      expected.inputs[0].txid
    )
    expect(parsedData.inputs[0].prevout.index).to.equal(
      expected.inputs[0].index
    )
    expect(parsedData.outputs[0].scriptHash).to.equal(
      expected.outputs[0].scriptHash
    )
    expect(parsedData.outputs[0].value).to.equal(expected.outputs[0].value)
  })
})

describe('isCompressed', function () {
  it('Check if key is compressed', function () {
    const compressedkey =
      '034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa'
    const unCompressedkey =
      '044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa385b6b1b8ead809ca67454d9683fcf2ba03456d6fe2c4abe2b07f0fbdbb2f1c1'

    const compressed: boolean = isCompressed(Buffer.from(compressedkey, 'hex'))
    assert(compressed, 'Key is not compressed')

    const unCompressed: boolean = isCompressed(Buffer.from(unCompressedkey, 'hex'))
    assert(!unCompressed, 'Key is compressed')
  })
})

describe('verifyWIF', function () {
  it('Verify WIF format', function () {
    const wifKey =
      '5J3mBbAH58CpQ3Y5RNJpUKPE62SQ5tfcvU2JpbnkeyhfsYB1Jcn'
    const network = 'bitcoin'
    const isWif: boolean = verifyWIF(wifKey, network)
    assert(isWif, 'key is not wif')
  })
})

describe('verifyUriProtocol', function () {
  it('Verify URI format', function () {
    const protocol1 = 'bitcoin:'
    const network1 = 'bitcoin'
    const pluginName1 = 'bitcoin'

    const protocol2 = 'bitcoincash:'
    const network2 = 'bitcoincash'
    const pluginName2 = 'bitcoincash'

    const protocol1Res: boolean = verifyUriProtocol(protocol1, network1, pluginName1)
    assert(protocol1Res, 'protocol 1 not verified')

    const protocol2Res: boolean = verifyUriProtocol(protocol2, network2, pluginName2)
    assert(protocol2Res, 'protocol 2 not verified')
  })
})

describe('keysFromEntropy', function () {
  const randomBuffer = Buffer.from('3427b1882ba3d76ce29ef5da26db6480b506a211d9e8bfe487172cf738581cc2', 'hex')
  const secretKey = 'crouch diesel ginger firm dice reopen media team surface cycle summer accident expire extra electric dial say category shift fly inform clown indoor economy'
  it('Test keysFromEntropy no opts', function () {
    const network = 'bitcoin'
    const coinType = 0
    const res = keysFromEntropy(randomBuffer, network, {})
    assert.equal(res[network + 'Key'], secretKey)
    assert.equal(res.format, networks[network].formats[0])
    assert.equal(res.coinType, coinType)
  })

  it('Test keysFromEntropy with opts', function () {
    const network = 'bitcoincash'
    const opts = { format: 'bip44', coinType: 145 }
    const res = keysFromEntropy(randomBuffer, network, opts)
    assert.equal(res[network + 'Key'], secretKey)
    assert.equal(res.format, opts.format)
    assert.equal(res.coinType, opts.coinType)
  })
})

describe('creatTx', function () {
  const utxos = [
    { index: 0,
      tx: { hash: 'f389be2868968e5985f625e7a9861e128f366877ea1372f26f1506e6f09a2c10',
        witnessHash: '12d13897bfdfcb5925949c49274b4301874f22e6c5c2d9c6537fdf4e66f5af9b',
        size: 247,
        virtualSize: 166,
        value: '33.89979885',
        fee: '0.0',
        rate: '0.0',
        minFee: '0.00000166',
        height: -1,
        block: null,
        time: 0,
        date: null,
        index: -1,
        version: 1,
        inputs: [Array],
        outputs: [Array],
        locktime: 0 },
      height: 1326320 },
    { index: 0,
      tx: { hash: '25d9425efea7dba41613aec608e7ffe634fc413e0fc6c287ffafe1848d967ecf',
        witnessHash: 'f112c0c0d940a702d3935aa921e35d6ca514cfc8fb83c90ce613d6fd693411af',
        size: 250,
        virtualSize: 168,
        value: '956.51664095',
        fee: '0.0',
        rate: '0.0',
        minFee: '0.00000168',
        height: -1,
        block: null,
        time: 0,
        date: null,
        index: -1,
        version: 1,
        inputs: [Array],
        outputs: [Array],
        locktime: 0 },
      height: 1293577 },
    { index: 1,
      tx: { hash: 'c119958d1262b5bfe2cc1fc6ef8bf83f0c7cf94b0f5415c8c0c479c1dc436cd1',
        witnessHash: 'c119958d1262b5bfe2cc1fc6ef8bf83f0c7cf94b0f5415c8c0c479c1dc436cd1',
        size: 225,
        virtualSize: 225,
        value: '2839.08439724',
        fee: '0.0',
        rate: '0.0',
        minFee: '0.00000225',
        height: -1,
        block: null,
        time: 0,
        date: null,
        index: -1,
        version: 2,
        inputs: [Array],
        outputs: [Array],
        locktime: 1293576 },
      height: 1293577 }
  ]
  const outputs = [ { address: '2N9DbpGaQEeLLZgPQP4gc9oKkrFHdsj5Eew', value: 250491781 } ]
  const changeAddress = '2MutS8m3G227LZntB6Qe8vMin92uRcePLA6'
  const rate = 1000000
  const maxFee = 1000000
  const height = 1448672
  const estimate = prev => FormatSelector.estimateSize(prev)
  const network = 'bitcointestnet'

  const txOpts: CreateTxOptions = {
    utxos,
    outputs,
    changeAddress,
    rate,
    maxFee,
    height,
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
    const res = await createTX(txOpts)
    console.log(res.test)
  })
})
