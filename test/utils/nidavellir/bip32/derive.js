// @flow

import { assert } from "chai";
import { describe, it } from "mocha";

import * as Derive from "../../../../src/utils/nidavellir/bip32/derive.js";
import fixtures from "./fixtures.json";

const deriveFixtures = fixtures.derive;

describe("Testing Key derivation", function() {
  deriveFixtures.private.forEach(test => {
    it(`Deriving private key without public key ${test[0]} for index ${test[2]}`, async function() {
      const privateKey = test[0];
      const chainCode = test[1];
      const index = test[2];
      const hardened = test[3];
      const expectedChildKey = {
        privateKey: test[4],
        chainCode: test[5],
        childIndex: test[6]
      };
      const childKey = await Derive.derivePrivate(
        privateKey,
        index,
        chainCode,
        hardened
      );
      assert.deepEqual(childKey, expectedChildKey);
    });
  });

  deriveFixtures.privateWithPublic.forEach(test => {
    it(`Deriving private key with public key ${test[0]} for index ${test[2]}`, async function() {
      const privateKey = test[0];
      const chainCode = test[1];
      const index = test[2];
      const hardened = test[3];
      const expectedChildKey = {
        privateKey: test[4],
        chainCode: test[5],
        childIndex: test[6]
      };
      const publicKey = test[7];
      const childKey = await Derive.derivePrivate(
        privateKey,
        index,
        chainCode,
        hardened,
        publicKey
      );
      assert.deepEqual(childKey, expectedChildKey);
    });
  });

  deriveFixtures.public.forEach(test => {
    it(`Deriving public key ${test[0]} for index ${test[2]}`, async function() {
      const publicKey = test[0];
      const chainCode = test[1];
      const index = test[2];
      const hardened = test[3];
      const expectedChildKey = {
        publicKey: test[4],
        chainCode: test[5],
        childIndex: test[6]
      };
      const childKey = await Derive.derivePublic(
        publicKey,
        index,
        chainCode,
        hardened
      );
      assert.deepEqual(childKey, expectedChildKey);
    });
  });
});
