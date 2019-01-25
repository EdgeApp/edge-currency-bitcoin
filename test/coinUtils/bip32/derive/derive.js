// @flow
// eslint-disable-next-line no-unused-vars
import * as Factories from '../../../../src/index.js'
import {
  derivePublic,
  derivePrivate
} from '../../../../src/coinUtils/bip32/derive.js'
// import * as ExtendedKey from '../../../../src/utils/bcoinUtils/bip32/extendedKey.js'
import { describe, it } from 'mocha'
import { assert } from 'chai'
import fixtures from './fixtures.json'
// const network = 'bitcoin'

describe('Testing Key derivation', function () {
  fixtures.private.forEach(test => {
    it(`Deriving private key without public key ${test[0]} for index ${
      test[2]
    }`, async function () {
      const privateKey = Buffer.from(test[0], 'hex')
      const chainCode = Buffer.from(test[1], 'hex')
      const index = test[2]
      const hardened = test[3]
      const expectedChildKey = {
        privateKey: Buffer.from(test[4], 'hex'),
        chainCode: Buffer.from(test[5], 'hex'),
        childIndex: test[6]
      }
      const childKey = await derivePrivate(
        privateKey,
        index,
        chainCode,
        hardened
      )
      assert.deepEqual(childKey, expectedChildKey)
    })
  })

  fixtures.privateWithPublic.forEach(test => {
    it(`Deriving private key with public key ${test[0]} for index ${
      test[2]
    }`, async function () {
      const privateKey = Buffer.from(test[0], 'hex')
      const chainCode = Buffer.from(test[1], 'hex')
      const index = test[2]
      const hardened = test[3]
      const expectedChildKey = {
        privateKey: Buffer.from(test[4], 'hex'),
        chainCode: Buffer.from(test[5], 'hex'),
        childIndex: test[6]
      }
      const publicKey = Buffer.from(test[7], 'hex')
      const childKey = await derivePrivate(
        privateKey,
        index,
        chainCode,
        hardened,
        publicKey
      )
      assert.deepEqual(childKey, expectedChildKey)
    })
  })

  fixtures.public.forEach(test => {
    it(`Deriving public key ${test[0]} for index ${test[2]}`, async function () {
      const publicKey = Buffer.from(test[0], 'hex')
      const chainCode = Buffer.from(test[1], 'hex')
      const index = test[2]
      const hardened = test[3]
      const expectedChildKey = {
        publicKey: Buffer.from(test[4], 'hex'),
        chainCode: Buffer.from(test[5], 'hex'),
        childIndex: test[6]
      }
      const childKey = await derivePublic(publicKey, index, chainCode, hardened)
      assert.deepEqual(childKey, expectedChildKey)
    })
  })
})
