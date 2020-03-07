// @flow

import EventEmitter from "events";
import { readdirSync, statSync } from "fs";
import { join } from "path";

import { assert } from "chai";
import { navigateDisklet } from "disklet";
import {
  type EdgeCorePlugin,
  type EdgeCorePluginOptions,
  type EdgeCurrencyPlugin,
  type EdgeCurrencyTools,
  makeFakeIo
} from "edge-core-js";
import { readFileSync } from "jsonfile";
import { before, describe, it } from "mocha";
import fetch from "node-fetch";
import request from "request";

import edgeCorePlugins from "../../../src/index.js";
import { createCachePath, envSettings } from "../../../src/utils/utils.js";

const DATA_STORE_FOLDER = "txEngineFolderBTC";
const FIXTURES_FOLDER = join(__dirname, "fixtures");

const fixtureFile = "tests.json";

const createCallbacks = (emitter: EventEmitter) => ({
  onAddressesChecked(progressRatio) {
    // console.log('onAddressesCheck', progressRatio)
    emitter.emit("onAddressesCheck", progressRatio);
  },
  onBalanceChanged(currencyCode, balance) {
    console.log("onBalanceChange:", currencyCode, balance);
    emitter.emit("onBalanceChange", currencyCode, balance);
  },
  onBlockHeightChanged(height) {
    // console.log('onBlockHeightChange:', height)
    emitter.emit("onBlockHeightChange", height);
  },
  onTransactionsChanged(transactionList) {
    // console.log('onTransactionsChanged:', transactionList)
    emitter.emit("onTransactionsChanged", transactionList);
  },
  onTxidsChanged() {}
});

const createPlugin = (io, { key, pluginName, currencyCode }) => {
  const pluginOpts: EdgeCorePluginOptions = {
    io: {
      ...io,
      random: size => key,
      fetch: fetch
    },
    initOptions: {},
    nativeIo: {},
    pluginDisklet: io.disklet
  };

  const factory = edgeCorePlugins[pluginName];
  if (typeof factory !== "function") throw new TypeError("Bad plugin");
  const corePlugin: EdgeCorePlugin = factory(pluginOpts);
  const plugin: EdgeCurrencyPlugin = (corePlugin: any);

  assert.equal(plugin.currencyInfo.currencyCode, currencyCode);

  return plugin;
};

const createTestSettings = dir => {
  const fixtureDataPath = join(FIXTURES_FOLDER, dir);
  const fixture = readFileSync(join(fixtureDataPath, fixtureFile));
  const fakeIo = makeFakeIo();
  const emitter = new EventEmitter();
  const plugin = createPlugin(fakeIo, fixture);
  const toolsPromise: Promise<EdgeCurrencyTools> = plugin.makeCurrencyTools();
  const callbacks = createCallbacks(emitter);
  const walletLocalDisklet = navigateDisklet(fakeIo.disklet, DATA_STORE_FOLDER);
  const walletLocalEncryptedDisklet = walletLocalDisklet;

  return {
    fixtureDataPath,
    fixture,
    engineOpts: {
      callbacks,
      walletLocalDisklet,
      walletLocalEncryptedDisklet,
      userSettings: fixture.ChangeSettings
    },
    emitter,
    plugin,
    toolsPromise
  };
};

const createKeys = async (tools, { format, type }) => {
  // Hack for now until we change all the dummy data to represent the new derivation path
  const keys = await tools.createPrivateKey(type);
  return Object.assign(keys, { coinType: 0, format });
};

// return only the directories inside fixtures dir
const dirs = readdirSync(FIXTURES_FOLDER).filter(file =>
  statSync(join(FIXTURES_FOLDER, file)).isDirectory()
);

for (const dir of dirs) {
  const {
    fixtureDataPath,
    fixture,
    engineOpts,
    emitter,
    plugin,
    toolsPromise
  } = createTestSettings(dir);
  const WALLET_TYPE = fixture.type;
  let engine, tools;

  describe(`Testing Currency Engine for Wallet type ${WALLET_TYPE}`, function() {
    before(async function() {
      tools = await toolsPromise;
      const { fileNames } = envSettings;
      for (const file in fileNames) {
        try {
          const fileName = fileNames[file];
          const filePath = join(fixtureDataPath, fileName);
          const fileData = readFileSync(filePath);
          const dataStr = JSON.stringify(fileData);
          const cachePath = createCachePath(fileName);
          await engineOpts.walletLocalDisklet.setText(cachePath, dataStr);
        } catch (e) {}
      }
    });

    describe("Engine Creation Errors", function() {
      this.timeout(0);
      it("Error when Making Engine without keys", async function() {
        try {
          await plugin.makeCurrencyEngine(
            // $FlowFixMe
            { type: WALLET_TYPE, id: "!" },
            engineOpts
          );
          throw new Error();
        } catch (e) {
          assert.equal(e.message, "Missing Master Key");
        }
      });

      it("Error when Making Engine without key", async function() {
        const keys = await createKeys(tools, fixture);
        try {
          await plugin.makeCurrencyEngine(
            { type: WALLET_TYPE, keys: { ninjaXpub: keys.pub }, id: "!" },
            engineOpts
          );
          throw new Error();
        } catch (e) {
          assert.equal(e.message, "Missing Master Key");
        }
      });
    });

    describe("Start Engine", function() {
      it("Make Engine", async function() {
        const keys = await createKeys(tools, fixture);
        const { id, userSettings } = fixture["Make Engine"];
        engine = await plugin.makeCurrencyEngine(
          { type: WALLET_TYPE, keys, id },
          { ...engineOpts, userSettings }
        );

        assert.equal(typeof engine.startEngine, "function", "startEngine");
        assert.equal(typeof engine.killEngine, "function", "killEngine");
        // assert.equal(typeof engine.enableTokens, 'function', 'enableTokens')
        assert.equal(
          typeof engine.getBlockHeight,
          "function",
          "getBlockHeight"
        );
        assert.equal(typeof engine.getBalance, "function", "getBalance");
        assert.equal(
          typeof engine.getNumTransactions,
          "function",
          "getNumTransactions"
        );
        assert.equal(
          typeof engine.getTransactions,
          "function",
          "getTransactions"
        );
        assert.equal(
          typeof engine.getFreshAddress,
          "function",
          "getFreshAddress"
        );
        assert.equal(
          typeof engine.addGapLimitAddresses,
          "function",
          "addGapLimitAddresses"
        );
        assert.equal(typeof engine.isAddressUsed, "function", "isAddressUsed");
        assert.equal(typeof engine.makeSpend, "function", "makeSpend");
        assert.equal(typeof engine.signTx, "function", "signTx");
        assert.equal(typeof engine.broadcastTx, "function", "broadcastTx");
        assert.equal(typeof engine.saveTx, "function", "saveTx");
      });
    });

    describe("Sign message using wallet's addresses", function() {
      const signMessage = fixture["Sign message"];
      Object.keys(signMessage).forEach(test => {
        const { message, address, signature, publicKey } = signMessage[test];
        it(`Sign message - ${test}`, async function() {
          const otherParams = {
            signMessage: {
              message,
              address
            }
          };
          // $FlowFixMe
          const edgeTransaction = await engine.signTx({ otherParams });
          const signedMessage = edgeTransaction.otherParams.signMessage;
          assert.equal(publicKey, signedMessage.publicKey, "publicKey");
          assert.equal(signature, signedMessage.signature, "signature");
        });
      });
    });

    describe("Is Address Used from cache", function() {
      const testCases = fixture["Address used from cache"];
      const wrongFormat = testCases.wrongFormat || [];
      const notInWallet = testCases.notInWallet || [];
      const empty = testCases.empty || {};
      const nonEmpty = testCases.nonEmpty || {};

      wrongFormat.forEach(address => {
        it("Checking a wrong formated address", function() {
          try {
            engine.isAddressUsed(address);
          } catch (e) {
            assert(e, "Should throw");
            assert.equal(e.message, "Wrong formatted address");
          }
        });
      });

      notInWallet.forEach(address => {
        it("Checking an address we don't own", function() {
          try {
            assert.equal(engine.isAddressUsed(address), false);
          } catch (e) {
            assert(e, "Should throw");
            assert.equal(e.message, "Address not found in wallet");
          }
        });
      });

      Object.keys(empty).forEach(test => {
        it(`Checking an empty ${test}`, function() {
          assert.equal(engine.isAddressUsed(empty[test]), false);
        });
      });

      Object.keys(nonEmpty).forEach(test => {
        it(`Checking a non empty ${test}`, function() {
          assert.equal(engine.isAddressUsed(nonEmpty[test]), true);
        });
      });
    });

    describe("Get Transactions", function() {
      it("Should get number of transactions from cache", function() {
        assert.equal(
          engine.getNumTransactions({}),
          fixture.txCount,
          `should have ${fixture.txCount} tx from cache`
        );
      });

      it("Should get transactions from cache", async function() {
        const txs = await engine.getTransactions({});
        assert.equal(
          txs.length,
          fixture.txCount,
          `should have ${fixture.txCount} tx from cache`
        );
      });

      it("Should get transactions from cache with options", async function() {
        const txs = await engine.getTransactions({
          startIndex: 1,
          startEntries: 2
        });
        assert.equal(txs.length, 2, "should have 2 tx from cache");
      });
    });

    describe("Should Add Gap Limit Addresses", function() {
      const gapAddresses = fixture["Add Gap Limit"];
      const derived = gapAddresses.derived || [];
      const future = gapAddresses.future || [];

      it("Add Empty Array", function() {
        engine.addGapLimitAddresses([]);
      });

      it("Add Already Derived Addresses", function() {
        engine.addGapLimitAddresses(derived);
      });

      it("Add Future Addresses", function() {
        engine.addGapLimitAddresses(future);
      });
    });

    describe("Should start engine", function() {
      it("Get BlockHeight", function(done) {
        const { uri, defaultHeight } = fixture.BlockHeight;
        let heightExpected = defaultHeight;
        this.timeout(10000);
        const testHeight = () => {
          emitter.on("onBlockHeightChange", height => {
            if (height >= heightExpected) {
              emitter.removeAllListeners("onBlockHeightChange");
              assert(engine.getBlockHeight() >= heightExpected, "Block height");
              // Can be "" since the promise resolves before the event fires but just be on the safe side
              done();
            }
          });
          engine.startEngine().catch(e => {
            console.log("startEngine error", e, e.message);
          });
        };
        if (uri) {
          request.get(uri, (err, res, body) => {
            assert(!err, "getting block height from a second source");
            const thirdPartyHeight = parseInt(JSON.parse(body).height);
            if (thirdPartyHeight && !isNaN(thirdPartyHeight)) {
              heightExpected = thirdPartyHeight;
            }
            testHeight();
          });
        } else {
          testHeight();
        }
      });
    });

    describe("Get Wallet Keys", function() {
      it("get private key", function() {
        engine.getDisplayPrivateSeed();
      });
      it("get public key", function() {
        engine.getDisplayPublicSeed();
      });
    });

    // describe(`Is Address Used from network`, function () {
    //   it('Checking a non empty P2WSH address', function () {
    //     setTimeout(() => {
    //       assert.equal(engine.isAddressUsed('tb1qzsqz3akrp8745gsrl45pa2370gculzwx4qcf5v'), true)
    //     }, 1000)
    //   })

    //   it('Checking a non empty address P2SH', function () {
    //     setTimeout(() => {
    //       assert.equal(engine.isAddressUsed('2MtegHVwZFy88UjdHU81wWiRkwDq5o8pWka'), true)
    //     }, 1000)
    //   })
    // })

    describe(`Get Fresh Address`, function() {
      it("Should provide a non used BTC address when no options are provided", function(done) {
        this.timeout(10000);
        const { uri } = fixture.FreshAddress;
        const address = engine.getFreshAddress({}); // TODO
        request.get(`${uri}${address.publicAddress}`, (err, res, body) => {
          if (!err) {
            const thirdPartyBalance = parseInt(JSON.parse(body).total_received);
            assert(!err, "getting address incoming txs from a second source");
            assert(thirdPartyBalance === 0, "Should have never received coins");
          } else {
            // $FlowFixMe
            const engineState: any = engine.engineState;
            const scriptHash = engineState.scriptHashes[address.publicAddress];
            const transactions = engineState.addressInfos[scriptHash].txids;
            assert(
              transactions.length === 0,
              "Should have never received coins"
            );
          }
          done();
        });
      });
    });

    describe(`Make Spend and Sign`, function() {
      const spendTests = fixture.Spend || {};
      const insufficientTests = fixture.InsufficientFundsError || {};

      it("Should fail since no spend target is given", function() {
        const spendInfo = {
          networkFeeOption: "high",
          metadata: {
            name: "Transfer to College Fund",
            category: "Transfer:Wallet:College Fund"
          },
          spendTargets: []
        };
        return engine.makeSpend(spendInfo).catch(e => {
          assert(e, "Should throw");
        });
      });

      Object.keys(spendTests).forEach(test => {
        it(`Should build transaction with ${test}`, function() {
          this.timeout(10000);
          const templateSpend = spendTests[test];
          return engine
            .makeSpend(templateSpend)
            .then(a => {
              return engine.signTx(a);
            })
            .then(a => {
              // console.log('sign', a)
            });
        });
      });

      Object.keys(insufficientTests).forEach(test => {
        it(`Should throw InsufficientFundsError for ${test}`, function() {
          const templateSpend = insufficientTests[test];
          return engine
            .makeSpend(templateSpend)
            .catch(e => assert.equal(e.message, "InsufficientFundsError"));
        });
      });
    });

    describe(`Sweep Keys and Sign`, function() {
      const sweepTests = fixture.Sweep || {};

      Object.keys(sweepTests).forEach(test => {
        it(`Should build transaction with ${test}`, function() {
          this.timeout(10000);
          const templateSpend = sweepTests[test];
          if (engine.sweepPrivateKeys == null) {
            throw new Error("No sweepPrivateKeys");
          }
          return engine
            .sweepPrivateKeys(templateSpend)
            .then(a => {
              return engine.signTx(a);
            })
            .then(a => {
              // console.warn('sign', a)
            });
        });
      });
    });

    describe("Stop Engine", function() {
      it("dump the wallet data", function() {
        const dataDump = engine.dumpData();
        const { id } = fixture["Make Engine"];
        assert(dataDump.walletId === id, "walletId");
        assert(dataDump.walletType === WALLET_TYPE, "walletType");
        assert(dataDump.walletFormat === fixture.format, "walletFormat");
      });

      it("changeSettings", async function() {
        await engine.changeUserSettings(fixture.ChangeSettings);
      });

      it("Stop the engine", async function() {
        console.log("kill engine");
        await engine.killEngine();
      });

      it("Stop the plugin state", async function() {
        // $FlowFixMe
        await tools.state.disconnect();
      });
    });
  });
}
