// @flow
import type {
  EdgeParsedUri,
  EdgeCurrencyInfo
} from 'edge-core-js'

// eslint-disable-next-line no-unused-vars
import * as Factories from '../../src/index'
import { describe, it, before } from 'mocha'
import { assert } from 'chai'
import { biIDMakePath, bitIDParseUri, deriveBitIDMakeAddress } from '../../src/utils/bitID.js'

describe(`BitID Process`, function () {
  const currencyInfo: EdgeCurrencyInfo = { currencyInfo: 'BTC' }
  const bitIDURI = 'bitid:bitid.bitcoin.blue/callback?x=NONCE'
  const bitIDDomain = 'bitid.bitcoin.blue'
  const bitIDCallbackUri = 'http://bitid.bitcoin.blue/callback'
  const bitIDAddress = '1J34vj4wowwPYafbeibZGht3zy3qERoUM1'
  const bitIDSeed = 'inhale praise target steak garlic cricket paper better evil almost sadness crawl city banner amused fringe fox insect roast aunt prefer hollow basic ladder'
  const network = 'bitcoin'
  const index = 0

  before('BitID', function (done) {
    done()
  })

  it('Test BitID parse uri', function () {
    const parsedUri: EdgeParsedUri = bitIDParseUri(bitIDURI, currencyInfo)
    assert.equal(parsedUri.bitIDURI, bitIDURI)
    assert.equal(parsedUri.bitIDDomain, bitIDDomain)
    assert.equal(parsedUri.bitIDCallbackUri, bitIDCallbackUri)
  })

  it('Test BitID master path', function () {
    const masterPath = `m/13'/${0xbe553112}'/${0xc0af82cf}'/${0x4361fb3b}'/${0xedd2bf37}'`
    assert.equal(biIDMakePath(bitIDCallbackUri, index), masterPath)
  })

  it('Test BitID make address', async function () {
    const publicAddress = await deriveBitIDMakeAddress(index, bitIDCallbackUri, bitIDSeed, network)
    assert.equal(publicAddress.address, bitIDAddress)
  })
})
