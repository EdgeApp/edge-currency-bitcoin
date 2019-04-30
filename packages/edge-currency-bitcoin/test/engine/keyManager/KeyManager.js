// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'
import { setLogger, logger } from '../../../src/utils/logger.js'
import { KeyManager } from '../../../src/engine/keyManager.js'
// eslint-disable-next-line no-unused-vars
import * as Factories from '../../../src/index.js'
import fixtures from './fixtures.json'

const fakeLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
}

setLogger(fakeLogger)

// Add network to bcoin
for (const fixture of fixtures) {
  describe(`Key Manager for ${fixture.network}`, function () {
    let keyManager
    it('creates new key manager', function () {
      const options = { ...fixture }
      keyManager = new KeyManager(options)
      keyManager.on('newKey', (keys: any) => {
        logger.info(keys)
      })
      keyManager.on(
        'newAddress',
        (scriptHash: string, address: string, path: string) => {
          logger.info(scriptHash, address, path)
        }
      )
      return keyManager.load().then(() => {
        const pubSeed = keyManager.getPublicSeed()
        const seed = keyManager.getSeed()
        assert.equal(seed, options.seed)
        assert.equal(pubSeed, options.xpub)
        for (const path in keyManager.addressesMap) {
          const addresses = keyManager.addressesMap[path]
          assert.equal(Object.keys(addresses).length, 10)
        }
      })
    })
  })
}
