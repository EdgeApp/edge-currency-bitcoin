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
    bitcoinKey:
      'chicken valve parrot park animal proof youth detail glance review artwork cluster drive more charge lunar uncle neglect brain act rose job photo spot',
    bitcoinXpub:
      'xpub661MyMwAqRbcF6JxG5NqmWiCbURzYtg95A5T7m6bdJ27FHDuLcVHmAg4unEMvdNi5VniUWgxxDJM5odBjUUzuSNCciED3sbfdX37NsdKTiQ'
  }
}

const io = {
  fetch: () => true,
  random: size => size,
  net: require('net')
}

const engineState = new EngineState({
  callbacks: {},
  bcoin: {}, // TODO: Implement this
  pluginState: ({}: any), // TODO: Implement this
  io,
  localFolder: walletLocalFolder
})

describe(`Key Manager`, function () {
  let keyManager
  it('creates new key manager', function () {
    keyManager = new KeyManager(
      walletInfo,
      engineState,
      null,
      gapLimit,
      network
    )
    keyManager.load().then(() => {
      assert.equal(keyManager.keys.receive.children.length, 10)
      assert(keyManager.keys.receive.pubKey)
      assert.equal(keyManager.keys.change.children.length, 0)
      assert(!keyManager.keys.change.pubKey)
    })
  })
  it('should create new keys', function () {
    keyManager
      .use('695ea63c25dba84f51ec52de2d31f965730b447c0a8c594569c40184d85fe91b')
      .then(() => {
        assert.equal(keyManager.keys.receive.children.length, 17)
        assert(keyManager.keys.receive.pubKey)
        assert.equal(keyManager.keys.change.children.length, 0)
        assert(!keyManager.keys.change.pubKey)
      })
  })
})
