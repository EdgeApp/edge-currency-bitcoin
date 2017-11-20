// @flow

import { describe, it } from 'mocha'
import { assert } from 'chai'
import disklet from 'disklet'
import { KeyManager } from '../src/engine/keyManager.js'
import { EngineState } from '../src/engine/engine-state.js'

const network = 'bitcoin'
const walletLocalFolder = disklet.makeMemoryFolder()
const gapLimit = 10

const walletInfo = {
  id: '1',
  type: 'wallet:bitcoin',
  keys: {
    bitcoinKey: 'chicken valve parrot park animal proof youth detail glance review artwork cluster drive more charge lunar uncle neglect brain act rose job photo spot',
    bitcoinXpub: 'xpub661MyMwAqRbcF6JxG5NqmWiCbURzYtg95A5T7m6bdJ27FHDuLcVHmAg4unEMvdNi5VniUWgxxDJM5odBjUUzuSNCciED3sbfdX37NsdKTiQ'
  }
}

const io = {
  fetch: () => true,
  random: (size) => size,
  net: require('net')
}

const engineState = new EngineState({
  callbacks: {},
  bcoin: {}, // TODO: Implement this
  io,
  localFolder: walletLocalFolder
})

describe(`Key Manager`, function () {
  it('creates new key manager', function () {
    const keyManager = new KeyManager(walletInfo, engineState, gapLimit, network)
    assert.equal(keyManager.keys.receive.children.length, 10)
    assert(keyManager.keys.receive.pubKey)
    assert.equal(keyManager.keys.change.children.length, 0)
    assert(!keyManager.keys.change.pubKey)
  })
})
