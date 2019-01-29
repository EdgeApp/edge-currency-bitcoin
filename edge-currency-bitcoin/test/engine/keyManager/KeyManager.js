// @flow

// InfoFiles for networks
import { bitcoin } from '../../../src/info/bitcoin.js'
import { bitcoincash } from '../../../src/info/bitcoincash.js'

// Bcoin extender function
import { addNetwork } from '../../../src/utils/bcoinExtender/bcoinExtender.js'

import { describe, it } from 'mocha'
import { assert } from 'chai'
import { KeyManager } from '../../../src/engine/keyManager.js'
import fixtures from './fixtures.json'

// Add network to bcoin
addNetwork(bitcoin.bcoinInfo)
addNetwork(bitcoincash.bcoinInfo)

for (const fixture of fixtures) {
  describe(`Key Manager for ${fixture.network}`, function () {
    let keyManager
    it('creates new key manager', function () {
      const options = { ...fixture }
      keyManager = new KeyManager(options)
      keyManager.on('newKey', (keys: any) => {
        console.log(keys)
      })
      keyManager.on(
        'newAddress',
        (scriptHash: string, address: string, path: string) => {
          console.log(scriptHash, address, path)
        }
      )
      return keyManager.load().then(() => {
        const pubSeed = keyManager.getPublicSeed()
        const seed = keyManager.getSeed()
        assert.equal(seed, options.seed)
        assert.equal(pubSeed, options.rawKeys.master.xpub)
        const masterKeyChildren = keyManager.masterKey.children
        for (const path in masterKeyChildren) {
          const childKey = masterKeyChildren[path]
          const addressKeys = childKey.children
          for (const addressKeyPath in addressKeys) {
            const addressKey = addressKeys[addressKeyPath]
            assert.equal(Object.keys(addressKey.children).length, 10)
          }
        }
      })
    })
  })
}
