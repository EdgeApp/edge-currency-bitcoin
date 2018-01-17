// @flow

// Coins Plugin Info
import { bitcoincashInfo } from '../src/info/bitcoincash.js'
import bcoin from 'bcoin'
// Bcoin extender function
import { bcoinExtender } from '../src/utils/bcoinExtender'

import { describe, it } from 'mocha'
import { assert } from 'chai'
import { KeyManager } from '../src/engine/keyManager.js'
import type { KeyManagerCallbacks } from '../src/engine/keyManager.js'

const network = 'bitcoincash'
const gapLimit = 10
bcoinExtender(bcoin, bitcoincashInfo)

const keyManagerCallbacks: KeyManagerCallbacks = {
  onNewAddress: (scriptHash: string, address: string, path: string) => {
    console.log(scriptHash, address, path)
  },
  onNewKey: (keys: any) => {
    console.log(keys)
  }
}

describe(`Key Manager for BitcoinCash`, function () {
  let keyManager
  it('creates new key manager', function () {
    keyManager = new KeyManager({
      walletType: 'wallet:bitcoincash-bip44',
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
    })
    keyManager.load().then(() => {
      assert.equal(keyManager.keys.receive.children.length, 10)
      assert(keyManager.keys.receive.pubKey)
      assert.equal(keyManager.keys.change.children.length, 0)
      assert(!keyManager.keys.change.pubKey)
    })
  })
})
