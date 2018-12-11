import { describe, it, before } from 'mocha'
import { assert } from 'chai'
import { biIDMakePath } from '../../src/utils/bitID.js'

describe(`BitID master path`, function () {
  before('BitID', function (done) {
    done()
  })

  it('Test BitID master path', function () {
    const index = 0
    const uri = 'http://bitid.bitcoin.blue/callback'
    const masterPath = `m/13’/${0xbe553112}’/${0xc0af82cf}’/${0x4361fb3b}’/${0xedd2bf37}’/${index}`

    assert.equal(biIDMakePath(uri, index), masterPath)
  })
})
