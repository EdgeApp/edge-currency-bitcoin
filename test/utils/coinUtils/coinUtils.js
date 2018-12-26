// @flow
import { parseTransaction,
  isCompressed,
  verifyWIF,
  verifyUriProtocol,
  keysFromEntropy,
  createTX,
  getPrivateFromSeed,
  addressToScriptHash,
  getReceiveAddresses } from '../../../src/utils/coinUtils.js'

import type { CreateTxOptions } from '../../../src/utils/coinUtils.js'
import { FormatSelector } from '../../../src/utils/formatSelector.js'
import { describe, it } from 'mocha'
import { expect, assert } from 'chai'
import { networks, primitives } from 'bcoin'
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
  // tx b6f6991d03df0e2e04dafffcd6bc418aac66049e2cd74b80f14ac86db1e3f0da
  const rawTx1 = '010000000101820e2169131a77976cf204ce28685e49a6d2278861c33b6241ba3ae3e0a49f020000008b48304502210098a2851420e4daba656fd79cb60cb565bd7218b6b117fda9a512ffbf17f8f178022005c61f31fef3ce3f906eb672e05b65f506045a65a80431b5eaf28e0999266993014104f0f86fa57c424deb160d0fc7693f13fce5ed6542c29483c51953e4fa87ebf247487ed79b1ddcf3de66b182217fcaf3fcef3fcb44737eb93b1fcb8927ebecea26ffffffff02805cd705000000001976a91429d6a3540acfa0a950bef2bfdc75cd51c24390fd88ac80841e00000000001976a91417b5038a413f5c5ee288caa64cfab35a0c01914e88ac00000000'
  // tx cf1316e67e665b252cd55a50632e37a2a04fe53181cfcb562e621826bbeff5cc
  const rawTx2 = '0100000001382daab19d01ffd186c4c7c8d71342e5df61fdf6abfdd5fc704e3e9925a1e7be000000008a47304402203c4916a8534d5ebbf42993aa161ce60679e996046d1fa2b075e02dc85caabe7f02202ab020212dddecb0723b1975e87a5e7737f67a18e6581187b50c5b5335a16752014104050d83c611aaf880a50d9a8be3cddbc3a1a502665bdceccbcd8af131e93b2254c08da401f36e5ecf67fcea5b9b29620627cb32e23d7545570f3051a705861785ffffffff0200e57692020000001976a914ace3d76444582f14778b8ad83a32128172adbfea88ac40933402000000001976a914902155f5a64149db0baf41c8b13286736742513b88ac00000000'
  const output1: any = primitives.TX.fromRaw(rawTx1, 'hex')
  const output2: any = primitives.TX.fromRaw(rawTx2, 'hex')
  const utxos = [
    { index: 0,
      tx: output1,
      height: 154598
    },
    { index: 1,
      tx: output2,
      height: 154598
    }
  ]
  const outputs = [ { address: '1E96EqP5kArwuN6jGcv3nCdGYEaKNCBLJC', value: 10491781 } ]
  const changeAddress = '1ju2Ph97z9DE9Ue6KC8PbGg1EpDv4U9TW'
  const rate = 1000000
  const maxFee = 1000000
  const height = 154599
  const estimate = prev => FormatSelector.estimateSize(prev)
  const network = 'bitcoin'

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
    const tx = await createTX(txOpts)
    // console.log(tx.toJSON())
    assert.equal(tx.toJSON().hash, '2905e85863b890a169e659f35d053afa1e98ac803ee7f8009772540e5b831d15')
    assert.equal(tx.toJSON().hex, '0100000001daf0e3b16dc84af1804bd72c9e0466ac8a41bcd6fcffda042e0edf031d99f6b60000000000ffffffff028517a000000000001976a914902155f5a64149db0baf41c8b13286736742513b88ac43ce3305000000001976a914081ce5d85910bf71b232f7c6301aa74cc60a8ba588ac00000000')
  })
})

describe('getPrivateFromSeed', function () {
  it('Verify Private From Seed', async function () {
    const seed = 'will dust merge tunnel day horror myself penalty return stem choose track'
    const key = Buffer.from('xprv9s21ZrQH143K4BxU1U4xwFfBCx7XLB8RgGo96CFWeUU3Pi6BWJkc7xCQhCkwe2CBskuK4wpSecis1fdHBbE7CoLfnvRppsEqnm7NueyqKvJ')
    const network = 'bitcoin'
    const resKey = await getPrivateFromSeed(seed, network)
    assert.equal(resKey.xprivkey(), key)
  })
})

describe('addressToScriptHash', function () {
  it('Test addressToScriptHash', async function () {
    const address = '12cjLQhXwZxGTTonXetiBA9ibEBWxZGa1v'
    const network = 'bitcoin'
    const expectedScriptHash = '865f133970cacf284360e0932da8c14e8a06d4338fe7c131bea3954a920d8f63'
    const scriptHash = await addressToScriptHash(address, network)
    assert.equal(scriptHash, expectedScriptHash)
  })
})

describe('getReceiveAddresses', function () {
  it('Test getReceiveAddresses', async function () {
    // tx b6f6991d03df0e2e04dafffcd6bc418aac66049e2cd74b80f14ac86db1e3f0da
    const rawTx1 = '010000000101820e2169131a77976cf204ce28685e49a6d2278861c33b6241ba3ae3e0a49f020000008b48304502210098a2851420e4daba656fd79cb60cb565bd7218b6b117fda9a512ffbf17f8f178022005c61f31fef3ce3f906eb672e05b65f506045a65a80431b5eaf28e0999266993014104f0f86fa57c424deb160d0fc7693f13fce5ed6542c29483c51953e4fa87ebf247487ed79b1ddcf3de66b182217fcaf3fcef3fcb44737eb93b1fcb8927ebecea26ffffffff02805cd705000000001976a91429d6a3540acfa0a950bef2bfdc75cd51c24390fd88ac80841e00000000001976a91417b5038a413f5c5ee288caa64cfab35a0c01914e88ac00000000'
    const tx: any = primitives.TX.fromRaw(rawTx1, 'hex')
    const expectedAddress = '14pDqB95GWLWCjFxM4t96H2kXH7QMKSsgG'
    const network = 'bitcoin'
    const address = await getReceiveAddresses(tx, network)
    assert.equal(address[0], expectedAddress)
  })
})
