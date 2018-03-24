// @flow

// Coins Plugin Info
import { bitcoinInfo } from '../src/info/bitcoin.js'
import bcoin from 'bcoin'
// Bcoin extender function
import { bcoinExtender } from '../src/utils/bcoinExtender'

import { describe, it } from 'mocha'
import { assert } from 'chai'
import { KeyManager } from '../src/engine/keyManager.js'
import type { KeyManagerCallbacks } from '../src/engine/keyManager.js'

const network = 'bitcoin'
const gapLimit = 10
bcoinExtender(bcoin, bitcoinInfo)

const keyManagerCallbacks: KeyManagerCallbacks = {
  onNewAddress: (scriptHash: string, address: string, path: string) => {
    console.log(scriptHash, address, path)
  },
  onNewKey: (keys: any) => {
    console.log(keys)
  }
}

describe(`Key Manager`, function () {
  let keyManager
  it('creates new key manager', function () {
    const options = {
      walletType: 'wallet:bitcoin',
      bip: 'bip49',
      rawKeys: {
        master: {
          xpub:
            'xpub661MyMwAqRbcF6JxG5NqmWiCbURzYtg95A5T7m6bdJ27FHDuLcVHmAg4unEMvdNi5VniUWgxxDJM5odBjUUzuSNCciED3sbfdX37NsdKTiQ'
        }
      },
      seed:
        'chicken valve parrot park animal proof youth detail glance review artwork cluster drive more charge lunar uncle neglect brain act rose job photo spot',
      gapLimit: gapLimit,
      network: network,
      callbacks: keyManagerCallbacks
    }
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
