// @flow

// Coins Plugin Info
import bcoin from 'bcoin'
// InfoFiles for networks
import { bitcoinInfo } from '../../src/info/bitcoin.js'
import { bitcoincashInfo } from '../../src/info/bitcoincash.js'

// Bcoin extender function
import { bcoinExtender } from '../../src/utils/bcoinExtender'

import { describe, it } from 'mocha'
import { assert } from 'chai'
import { KeyManager } from '../../src/engine/keyManager.js'
import type { KeyManagerCallbacks } from '../../src/engine/keyManager.js'
import fixtures from './fixtures.json'

// Add network to bcoin
bcoinExtender(bcoin, bitcoinInfo)
bcoinExtender(bcoin, bitcoincashInfo)

for (const fixture of fixtures) {
  const keyManagerCallbacks: KeyManagerCallbacks = {
    onNewAddress: (scriptHash: string, address: string, path: string) => {
      console.log(scriptHash, address, path)
    },
    onNewKey: (keys: any) => {
      console.log(keys)
    }
  }
  describe(`Key Manager for ${fixture.network}`, function () {
    let keyManager
    it('creates new key manager', function () {
      const options = { ...fixture, callbacks: keyManagerCallbacks }
      keyManager = new KeyManager(options)
      return keyManager.load().then(() => {
        const pubSeed = keyManager.getPublicSeed()
        const seed = keyManager.getSeed()
        assert.equal(seed, options.seed)
        assert.equal(pubSeed, options.rawKeys.master.xpub)
        assert.equal(keyManager.keys.receive.children.length, 10)
        assert(keyManager.keys.receive.pubKey)
        assert.equal(keyManager.keys.change.children.length, 10)
        assert(keyManager.keys.change.pubKey)
      })
    })
  })
}
