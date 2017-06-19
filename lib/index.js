'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var rfc4648 = require('rfc4648');

var bcoin = require('bcoin');

/* global */

var txLibInfo = {
  supportedTokens: ['BTC'],

  getInfo: {
    // Details of supported currency
    currencyCode: 'BTC', // The 3 character code for the currency
    denominations: [
      // An array of Objects of the possible denominations for this currency
      {
        name: 'bits', // The human readable string to describe the denomination
        multiplier: 100, // The value to multiply the smallest unit of currency to get to the denomination
        symbol: 'μBTC' // The human readable 1-3 character symbol of the currency, e.g “Ƀ”
      },
      {
        name: 'mBTC',
        multiplier: 100000,
        symbol: 'mB'
      },
      {
        name: 'BTC',
        multiplier: 100000000,
        symbol: 'B'
      }
    ],
    symbolImage: 'qq/2iuhfiu1/3iufhlq249r8yq34tiuhq4giuhaiwughiuaergih/rg', // Base64 encoded png or jpg image of the currency symbol (optional)
    metaTokens: [
      // Array of objects describing the supported metatokens
      {
        currencyCode: 'BTC',
        denominations: [
          {
            name: 'BTC',
            multiplier: 1
          }
        ],
        symbolImage: 'fe/3fthfiu1/3iufhlq249r8yq34tiuhqggiuhaiwughiuaergih/ef'
      }
    ]
  }
};

// abcWalletTxLib-btc.js
// const random = require('random-js')
var GAP_LIMIT = 10;
var DATA_STORE_FOLDER = 'txEngineFolder';
var DATA_STORE_FILE = 'walletLocalData.json';
var ADDRESS_POLL_MILLISECONDS = 20000;
var TRANSACTION_POLL_MILLISECONDS = 3000;
var BLOCKHEIGHT_POLL_MILLISECONDS = 60000;
var SAVE_DATASTORE_MILLISECONDS = 10000;

var PRIMARY_CURRENCY = txLibInfo.getInfo.currencyCode;
var TOKEN_CODES = [PRIMARY_CURRENCY].concat(txLibInfo.supportedTokens);

var baseUrl = 'http://shitcoin-az-braz.airbitz.co:8080/api/';
// const baseUrl = 'http://localhost:8080/api/'

function makeBitcoinPlugin (opts) {
  if ( opts === void 0 ) opts = {};

  var io = opts.io;

  return {
    getInfo: function () {
      var currencyDetails = txLibInfo.getInfo;

      return currencyDetails
    },

    createMasterKeys: function (walletType) {
      if (walletType === 'shitcoin') {
        var masterPrivateKey = rfc4648.base16.stringify(io.random(8));
        var masterPublicKey = 'pub' + masterPrivateKey;
        return { masterPrivateKey: masterPrivateKey, masterPublicKey: masterPublicKey }
      } else if (walletType === 'bitcoin') {
        return null
      } else {
        return null
      }
    },

    makeEngine: function (keyInfo, opts) {
      if ( opts === void 0 ) opts = {};

      var abcTxLib = new ABCTxLibTRD(io, keyInfo, opts);

      return abcTxLib
    }
  }
}

var WalletLocalData = function WalletLocalData (jsonString) {
  var this$1 = this;

  this.blockHeight = 0;
  this.totalBalances = { TRD: 0 };

  // Map of gap limit addresses
  this.gapLimitAddresses = [];
  this.transactionsObj = {};

  // Array of ABCTransaction objects sorted by date from newest to oldest
  for (var n in TOKEN_CODES) {
    var currencyCode = TOKEN_CODES[n];
    this$1.transactionsObj[currencyCode] = [];
  }

  // Array of txids to fetch
  this.transactionsToFetch = [];

  // Array of address objects, unsorted
  this.addressArray = [];

  this.unusedAddressIndex = 0;
  this.masterPublicKey = '';
  this.enabledTokens = [PRIMARY_CURRENCY];
  if (jsonString != null) {
    var data = JSON.parse(jsonString);
    for (var k in data) {
      this$1[k] = data[k];
    }
  }
};

var ABCTransaction = function ABCTransaction (
  txid,
  date,
  currencyCode,
  blockHeight,
  amountSatoshi,
  networkFee,
  signedTx,
  otherParams
) {
  this.txid = txid;
  this.date = date;
  this.currencyCode = currencyCode;
  this.blockHeight = blockHeight;
  this.amountSatoshi = amountSatoshi;
  this.networkFee = networkFee;
  this.signedTx = signedTx;
  this.otherParams = otherParams;
};

var ABCTxLibTRD = function ABCTxLibTRD (io, keyInfo, opts) {
  if ( opts === void 0 ) opts = {};

  // dataStore.init(abcTxLibAccess, options, callbacks)
  var walletLocalFolder = opts.walletLocalFolder;
  var callbacks = opts.callbacks;

  // console.log(keyInfo);

  this.io = io;
  this.keyInfo = keyInfo;
  this.abcTxLibCallbacks = callbacks;
  this.walletLocalFolder = walletLocalFolder;

  this.engineOn = false;
  this.transactionsDirty = true;
  this.addressesChecked = false;
  this.numAddressesChecked = 0;
  this.numAddressesToCheck = 0;
  this.walletLocalData = {};
  this.walletLocalDataDirty = false;
  this.transactionsChangedArray = [];

  this.logger = new bcoin.logger({ level: 'debug', console: true });

  this.logger.writeConsole = function(level, module, args) {
    console.log(level,module,args);
    // if (level == 4 && module == "net" && args[0].substring(0,6) == "Status"){
    //   console.log("PROGRESS: ", args);
    // } 
  };

  this.logger.info = function(level, module, args) {
    console.log(level,module,args);
  };

  this.logger.open();

  this.chain = new bcoin.chain({
    db: 'leveldb',
    location: process.env.PWD + "/db" + '/spvchain14967688000312',
    spv: true,
    network: {
      name: "main",
      checkpointMap: {
        450000: '0ba2070c62cd9da1f8cef88a0648c661a411d33e728340010000000000000000'
      },
      lastCheckpoint:420000,
      genesis: {
        version: 0x20000000,
        hash: '41cd7e7d73a8c153db34f6b046ad6ca4472f2227f25f77020000000000000000',
        prevBlock: '  000000000000000002424db0163641940c9fd999ec897b412ce64e36d6ab7650',
        merkleRoot: '29d000eee85f08b6482026be2d92d081d6f9418346e6b2e9fe2e9b985f24ed1e',
        ts: 1482001679,
        bits: 402885509,
        nonce: 3814348197,
        height: 443870
      },
      genesisBlock: '000000205076abd6364ee62c417b89ec99d99f0c94413616b04d420200000000000000001eed245f989b2efee9b2e6468341f9d681d0922dbe262048b6085fe8ee00d0290f8d5558858b0318a5555ae30901000000010000000000000000000000000000000000000000000000000000000000000000ffffffff2b03dec5061e4d696e656420627920416e74506f6f6c206e6d30200d5f3c632058558d0f5d010000822a0900ffffffff013fe69a4a000000001976a9149338b976abdb1a5c8711ac57bb2417a98fdb8bac88ac00000000010000000183629871ebcc0ce8bfd1d9463fc7e906e1a3d17c909442bed54c10a599b53935000000006b483045022100ea916940af7b9b956a5bbca726a54648dd2cbc61de020f557a44cb42c3b8d3fd022051c95dc222576b841e4a689b1400527beba5b9128b68eb2c6f567808df4ef45601210382fd762515b68a938074a17d8a2aa054a60fb9594e2c92656a29244860dbf7c5fdffffff0100213815000000001976a914e4134970cfd81d2f09760e052c509edd3832354d88ac000000000100000001dcd3cb30c9095b43e1e0ef14a8d92e39e3def37990d5b796e7e4d6d5a9aa0b68000000008b483045022100a64563af097eda61191f8c5d04b4f48ce5f4224403ce86dab8e1703b8d0d656d02206ff5f3a1c4f2a51cb65897b51c87e6dd420c708bcc8e9906807fd83938e95878014104892e31d04537248c9461f9cf42f093f015624354dcf6e98f17ba582ef1bf17c3c727c4940cac221fe0a4d60b3954047fcc7c53e24bb9268e5a3de403247607d0ffffffff016887bd00000000001976a9146253907064ab8ff696b6fc38d0d4c53a7064363e88ac0000000001000000016caeada964430fda0dd5bb5b7f7864d2709f53b65bc05d5803d88aa4b364ead6010000006a473044022075059a1e6dafc616beb62317f09328554cc00dc8cfbf79edddf42c63d89dcf9e02204cccbf262592b93376d7d94a6eb86dd7c24fc302169c66c8f183121934998dd00121021550188976a00d6883d823a935fb15e1678517d8d71db526e41d09a56351121cffffffff0240334a01000000001976a914ae16c3fb72dabcc8c1603d47add1c6de9f7d4c9d88acd0e2a308000000001976a9142e677d8c175b3555f25e6c1cc7bf23c210a4ade088ac00000000010000000130b5db594ac7ff1c62a000349f3907e416242473f96f3229caf689350fc8a2a3010000006a473044022070d8874081b440da7b1a6fce4fddbf9fbcb5b4529c044f5d235f64223224f34102203c9045efdf3d1abff866a350c03e8294d1dd95e9b0b1dd11c2f9bedf86dfefcd012103baae35e46fed6924db07497b3a11dfb2028ddb1ab30e561963114bfbd3849313ffffffff0380010500000000001976a914c975e98ea45d63ff419cd94897c4bc60b334efc388acfa492100000000001976a914c43a1fcbfe0022052c37afbb69fcf76dd11303df88ac88d23d00000000001976a9141caca033c6ad56eb0941bc5dffdea1c6c7b2dcda88ac00000000010000000139158b7696236b6a41d19e022d5b12b0800144679e68263434f2bd355d9cca4d050000006a473044022060a1a0ec9e71e5d2067ceb07077d1e9538ee182d1aed4908a3d4bc876ab004f702206ff2563cfe2fbe7ffa86d09d76ff8777e7e4c8cee8a14109be3c61deac4662ee012102bd01d1f7cf5b781cf4894d3a9f9c85c1cafdcc90f62570b43ccb92c4901fdb3cffffffff03888a0100000000001976a914a0922377ff3ba2c4f1564c0241fed9bf24ba222388aca23f0a00000000001976a914c43a1fcbfe0022052c37afbb69fcf76dd11303df88ac76081300000000001976a914c0bb45a93519233df7353744465e47e3dda5f87e88ac00000000010000000160712d3f07af17f69b74436587c3caacebbb3e4edbe8b8cb06b6364eb943f24f000000006b483045022100a8b2be366bf2c74a8aeadea0df663dee20603ebcd96698c6e563034adf0310e202200eb9fc0298e34b55acc5314fec3ad12ca8da5baab10cda58a1a98701560a75a80121031f750a5708036cabea86fa9d4848772ab0d2551607f3cf6c60cd2ea4dd2e6646ffffffff02c0af1c00000000001976a91410cb8d3dc6b073c0b68d6f399e4944a0f4a1a84b88ac002d3101000000001976a9140a926ae8852a1a1f87edf524236d0956029f972288ac0000000001000000018fc9626ed20c7d943bc09cf64321b8afe2bf62870e288dbdfd77fc3d23f1eb37000000006b483045022100b8a687ed39edf5c537b898e01fa8a26c43bdae600885d34807dc891b25671923022020967a0882923edf733c99bc42cb715e43c867138124d173768393ec1507b137012102380d8c3e5ee697e56b2cfcd7479f29279d1c3e4eb891fbb2363968df13fecda7ffffffff0288780400000000001976a914bbb60aff24ce5e47c2ed9942bac2047f4aa387d588ac822bb023000000001976a9147969f540fd85c642a982503c98e78ed19fcd9d7488ac000000000100000001772b81e53948c0ca782ec341b9fba4824ad49555ac06483adadd305d097f6043010000006a47304402207bdf4ed2228617688682c1b480733159dcce41163f25c0ed9269b91d6269316802204ef2eafe7e750e954151927fc935c6364b3974ee817a7259d251049e0835e259012102af53530edccec22e28a0dabbfb7bea86783681ec0377aca3fd94d1d2ec1408a8ffffffff02d01b5000000000001976a9149ac529b8ae8f1444b0b470378f51e45ca4cc014388ac69741906000000001976a9140f1ab338ab6fed8a64d1bf875954c4df177019c788ac00000000'
    },
    logConsole: true,
    logger: this.logger
  });

  this.pool = new bcoin.pool({
    chain: this.chain,
    spv: true,
    maxPeers: 8 ,
    logger: this.logger
  });

  // this.walletdb = new bcoin.walletdb({ db: 'leveldb', location: process.env.PWD + "/db" + '/wallet12' });
  this.walletdb = new bcoin.walletdb({ db: 'memory' });

};

// *************************************
// Private methods
// *************************************
ABCTxLibTRD.prototype.engineLoop = function engineLoop () {
  this.engineOn = true;
  this.blockHeightInnerLoop();
  this.checkAddressesInnerLoop();
  this.checkTransactionsInnerLoop();
  this.saveWalletDataStore();
};

ABCTxLibTRD.prototype.isTokenEnabled = function isTokenEnabled (token) {
  return this.walletLocalData.enabledTokens.indexOf(token) !== -1
};

ABCTxLibTRD.prototype.fetchGet = function fetchGet (cmd, params) {
  return this.io.fetch(baseUrl + cmd + '/' + params, {
    method: 'GET'
  })
};

ABCTxLibTRD.prototype.fetchPost = function fetchPost (cmd, body) {
  return this.io.fetch(baseUrl + cmd, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify(body)
  })
};

// *************************************
// Poll on the blockheight
// *************************************
ABCTxLibTRD.prototype.blockHeightInnerLoop = function blockHeightInnerLoop () {
    var this$1 = this;

  if (this.engineOn) {
    var p = new Promise(function (resolve, reject) {
      this$1.fetchGet('height', '')
        .then(function (response) {
          return response.json()
        })
        .then(function (jsonObj) {
          if (this$1.walletLocalData.blockHeight !== jsonObj.height) {
            this$1.walletLocalData.blockHeight = jsonObj.height;
            this$1.walletLocalDataDirty = true;
            console.log(
              'Block height changed: ' + this$1.walletLocalData.blockHeight
            );
            this$1.abcTxLibCallbacks.blockHeightChanged(
              this$1.walletLocalData.blockHeight
            );
          }
          resolve();
        })
        .catch(function (err) {
          console.log('Error fetching height: ' + err);
          resolve();
        });
    });
    p.then(function () {
      setTimeout(function () {
        this$1.blockHeightInnerLoop();
      }, BLOCKHEIGHT_POLL_MILLISECONDS);
    });
  }
};

ABCTxLibTRD.prototype.checkTransactionsInnerLoop = function checkTransactionsInnerLoop () {
    var this$1 = this;

  if (this.engineOn) {
    var promiseArray = [];
    var numTransactions = this.walletLocalData.transactionsToFetch.length;

    for (var n = 0; n < numTransactions; n++) {
      var txid = this$1.walletLocalData.transactionsToFetch[n];
      var p = this$1.processTransactionFromServer(txid);
      promiseArray.push(p);
      console.log('checkTransactionsInnerLoop: check ' + txid);
    }

    if (promiseArray.length > 0) {
      Promise.all(promiseArray)
        .then(function (response) {
          setTimeout(function () {
            this$1.checkTransactionsInnerLoop();
          }, TRANSACTION_POLL_MILLISECONDS);
        })
        .catch(function (e) {
          console.log(
            new Error(
              'Error: checkTransactionsInnerLoop: should not get here'
            )
          );
          setTimeout(function () {
            this$1.checkTransactionsInnerLoop();
          }, TRANSACTION_POLL_MILLISECONDS);
        });
    } else {
      setTimeout(function () {
        this$1.checkTransactionsInnerLoop();
      }, TRANSACTION_POLL_MILLISECONDS);
    }
  }
};

ABCTxLibTRD.prototype.processTransactionFromServer = function processTransactionFromServer (txid) {
    var this$1 = this;

  return this.fetchGet('transaction', txid)
    .then(function (response) {
      return response.json()
    })
    .then(function (jsonObj) {
      console.log('processTransactionFromServer: response.json():');
      console.log(jsonObj);

      //
      // Calculate the amount sent from the wallet
      //

      // Iterate through all the inputs and see if any are in our wallet
      var spendAmounts = [];
      var receiveAmounts = [];
      var amountsSatoshi = [];

      var inputs = jsonObj.inputs;
      var outputs = jsonObj.outputs;

      var otherParams = {
        inputs: inputs,
        outputs: outputs
      };

      for (var c in TOKEN_CODES) {
        var currencyCode = TOKEN_CODES[c];
        receiveAmounts[currencyCode] = spendAmounts[currencyCode] = 0;

        for (var n in inputs) {
          var input = inputs[n];
          var addr = input.address;
          var ccode = input.currencyCode;
          var idx$1 = this$1.findAddress(addr);
          if (idx$1 !== -1 && ccode === currencyCode) {
            spendAmounts[ccode] += input.amount;
          }
        }

        // Iterate through all the outputs and see if any are in our wallet
        for (var n$1 in outputs) {
          var output = outputs[n$1];
          var addr$1 = output.address;
          var ccode$1 = output.currencyCode;
          var idx$2 = this$1.findAddress(addr$1);
          if (idx$2 !== -1 && ccode$1 === currencyCode) {
            receiveAmounts[ccode$1] += output.amount;
          }
        }
        amountsSatoshi[currencyCode] =
          receiveAmounts[currencyCode] - spendAmounts[currencyCode];

        // Create a txlib ABCTransaction object which must contain
        // txid, date, blockHeight, amountSatoshi, networkFee, signedTx, and optionally otherParams
        /*
        let networkFee = jsonObj.networkFee
        if (currencyCode != PRIMARY_CURRENCY) {
          networkFee = 0
        }
        */

        if (
          receiveAmounts[currencyCode] !== 0 ||
          spendAmounts[currencyCode] !== 0
        ) {
          var abcTransaction = new ABCTransaction(
            jsonObj.txid,
            jsonObj.txDate,
            currencyCode,
            jsonObj.blockHeight,
            amountsSatoshi[currencyCode],
            jsonObj.networkFee,
            'iwassignedyoucantrustme',
            otherParams
          );
          this$1.addTransaction(currencyCode, abcTransaction);
        }
      }

      // Remove txid from transactionsToFetch
      var idx = this$1.walletLocalData.transactionsToFetch.indexOf(
        jsonObj.txid
      );
      if (idx !== -1) {
        this$1.walletLocalData.transactionsToFetch.splice(idx, 1);
        this$1.walletLocalDataDirty = true;
      }

      if (this$1.walletLocalData.transactionsToFetch.length === 0) {
        this$1.abcTxLibCallbacks.transactionsChanged(
          this$1.transactionsChangedArray
        );
        this$1.transactionsChangedArray = [];
      }

      return 0
    })
    .catch(function (e) {
      console.log('Error fetching address');
      return 0
    })
};

// **********************************************
// Check all addresses for new transactions
// **********************************************
ABCTxLibTRD.prototype.checkAddressesInnerLoop = function checkAddressesInnerLoop () {
    var this$1 = this;

  if (this.engineOn) {
    var promiseArray = [];
    // var promiseArrayCount = 0
    for (
      var n = 0;
      n < this.walletLocalData.unusedAddressIndex + GAP_LIMIT;
      n++
    ) {
      var address = this$1.addressFromIndex(n);
      var p = this$1.processAddressFromServer(address);
      promiseArray.push(p);

      if (this$1.walletLocalData.addressArray[n] == null) {
        this$1.walletLocalData.addressArray[n] = { address: address };
        this$1.walletLocalDataDirty = true;
      } else {
        if (this$1.walletLocalData.addressArray[n].address !== address) {
          throw new Error('Derived address mismatch on index ' + n)
        }
      }

      console.log('checkAddressesInnerLoop: check ' + address);
    }

    if (promiseArray.length > 0) {
      this.numAddressesChecked = 0;
      this.numAddressesToCheck = promiseArray.length;
      Promise.all(promiseArray)
        .then(function (response) {
          // Iterate over all the address balances and get a final balance
          console.log(
            'checkAddressesInnerLoop: Completed responses: ' + response.length
          );

          var arrayAmounts = response;
          var totalBalances = { TRD: 0 };
          for (var n in arrayAmounts) {
            var amountsObj = arrayAmounts[n];
            for (var currencyCode in amountsObj) {
              if (totalBalances[currencyCode] == null) {
                totalBalances[currencyCode] = 0;
              }
              totalBalances[currencyCode] += amountsObj[currencyCode];
              console.log(
                'checkAddressesInnerLoop: arrayAmounts[' +
                  n +
                  '][' +
                  currencyCode +
                  ']: ' +
                  arrayAmounts[n][currencyCode] +
                  ' total:' +
                  totalBalances[currencyCode]
              );
            }
          }
          this$1.walletLocalData.totalBalances = totalBalances;
          this$1.walletLocalDataDirty = true;

          if (!this$1.addressesChecked) {
            this$1.addressesChecked = true;
            this$1.abcTxLibCallbacks.addressesChecked(1);
            this$1.numAddressesChecked = 0;
            this$1.numAddressesToCheck = 0;
          }
          setTimeout(function () {
            this$1.checkAddressesInnerLoop();
          }, ADDRESS_POLL_MILLISECONDS);
        })
        .catch(function (e) {
          console.log(
            new Error('Error: checkAddressesInnerLoop: should not get here')
          );
          setTimeout(function () {
            this$1.checkAddressesInnerLoop();
          }, ADDRESS_POLL_MILLISECONDS);
        });
    } else {
      setTimeout(function () {
        this$1.checkAddressesInnerLoop();
      }, ADDRESS_POLL_MILLISECONDS);
    }
  }
};

ABCTxLibTRD.prototype.addressFromIndex = function addressFromIndex (index) {
  var addr = '' + index + '_' + this.walletLocalData.masterPublicKey;

  if (index === 0) {
    addr = addr + '__600000'; // Preload first addresss with some funds
  }
  return addr
};

ABCTxLibTRD.prototype.processAddressFromServer = function processAddressFromServer (address) {
    var this$1 = this;

  return this.fetchGet('address', address)
    .then(function (response) {
      return response.json()
    })
    .then(function (jsonObj) {
      console.log('processAddressFromServer: response.json():');
      console.log(jsonObj);
      var txids = jsonObj.txids;
      var idx = this$1.findAddress(jsonObj.address);
      if (idx === -1) {
        throw new Error(
          'Queried address not found in addressArray:' + jsonObj.address
        )
      }
      this$1.walletLocalData.addressArray[idx] = jsonObj;
      this$1.walletLocalDataDirty = true;

      // Iterate over txids in address
      for (var n in txids) {
        // This address has transactions
        var txid = txids[n];
        console.log('processAddressFromServer: txid:' + txid);

        if (
          this$1.findTransaction(PRIMARY_CURRENCY, txid) === -1 &&
          this$1.walletLocalData.transactionsToFetch.indexOf(txid) === -1
        ) {
          console.log(
            'processAddressFromServer: txid not found. Adding:' + txid
          );
          this$1.walletLocalData.transactionsToFetch.push(txid);
          this$1.walletLocalDataDirty = true;

          this$1.transactionsDirty = true;
        }
      }

      if (
        (txids != null && txids.length) ||
        this$1.walletLocalData.gapLimitAddresses.indexOf(jsonObj.address) !== -1
      ) {
        // Since this address is "used", make sure the unusedAddressIndex is incremented if needed
        if (idx >= this$1.walletLocalData.unusedAddressIndex) {
          this$1.walletLocalData.unusedAddressIndex = idx + 1;
          this$1.walletLocalDataDirty = true;
          console.log(
            'processAddressFromServer: set unusedAddressIndex:' +
              this$1.walletLocalData.unusedAddressIndex
          );
        }
      }

      this$1.numAddressesChecked++;
      var progress = this$1.numAddressesChecked / this$1.numAddressesToCheck;

      if (progress !== 1) {
        this$1.abcTxLibCallbacks.addressesChecked(progress);
      }

      return jsonObj.amounts
    })
    .catch(function (e) {
      console.log('Error fetching address: ' + address);
      return 0
    })
};

ABCTxLibTRD.prototype.findTransaction = function findTransaction (currencyCode, txid) {
  if (this.walletLocalData.transactionsObj[currencyCode] == null) {
    return -1
  }

  var currency = this.walletLocalData.transactionsObj[currencyCode];
  return currency.findIndex(function (element) {
    return element.txid === txid
  })
};

ABCTxLibTRD.prototype.findAddress = function findAddress (address) {
  return this.walletLocalData.addressArray.findIndex(function (element) {
    return element.address === address
  })
};

ABCTxLibTRD.prototype.sortTxByDate = function sortTxByDate (a, b) {
  return b.date - a.date
};

ABCTxLibTRD.prototype.addTransaction = function addTransaction (currencyCode, abcTransaction) {
  // Add or update tx in transactionsObj
  var idx = this.findTransaction(currencyCode, abcTransaction.txid);

  if (idx === -1) {
    console.log('addTransaction: adding and sorting:' + abcTransaction.txid);
    this.walletLocalData.transactionsObj[currencyCode].push(abcTransaction);

    // Sort
    this.walletLocalData.transactionsObj[currencyCode].sort(this.sortTxByDate);
    this.walletLocalDataDirty = true;
  } else {
    // Update the transaction
    this.walletLocalData.transactionsObj[currencyCode][idx] = abcTransaction;
    this.walletLocalDataDirty = true;
    console.log('addTransaction: updating:' + abcTransaction.txid);
  }
  this.transactionsChangedArray.push(abcTransaction);
};

// *************************************
// Save the wallet data store
// *************************************
ABCTxLibTRD.prototype.saveWalletDataStore = function saveWalletDataStore () {
    var this$1 = this;

  if (this.engineOn) {
    if (this.walletLocalDataDirty) {
      var walletJson = JSON.stringify(this.walletLocalData);
      this.walletLocalFolder
        .folder(DATA_STORE_FOLDER)
        .file(DATA_STORE_FILE)
        .setText(walletJson)
        .then(function (result) {
          this$1.walletLocalDataDirty = false;
          setTimeout(function () {
            this$1.saveWalletDataStore();
          }, SAVE_DATASTORE_MILLISECONDS);
        })
        .catch(function (err) {
          console.log(err);
        });
    }
  }
};

// *************************************
// Public methods
// *************************************

ABCTxLibTRD.prototype.startEngine = function startEngine () {
  var this$1 = this;

  return this.pool.open().then(function() {
    return this$1.walletdb.open();
  }).then(function() {

    var w = new bcoin.hd.PrivateKey()
    w.fromSeed("5ad1fd622f79236309614c85c39b32b7999ef2ae175872e683c317db7375af5a")
    var key = w.toJSON()
    
    console.log("XPRIV", key.xprivkey);

    return this$1.walletdb.create({
        "master": key.xprivkey,
        "id": "AirBitzMain"
      });
  }).then(function(wallet) {
    console.log("Root m/0/0/0 => "+wallet.getID());
    this$1.wallet = wallet;
      console.log('Main address: '+ wallet.getAddress('base58check'));
      

    // Add our address to the spv filter.
    this$1.pool.watchAddress(wallet.getAddress());

    this$1.wallet.getAccountPaths(0).then(function(result){
        var a;
        for (var i in result){
          a =result[i].toAddress();

          // console.log("Paths======>",a.toString());
        }
      });
      this$1.pool.watchAddress(wallet.getAddress('base58check'));
      

      // wallet.getBalance(0).then(function(result){
      //     console.log("Balance======>",result);
      // });
      console.log("Generating 20 nearest addresses");
      for (var i=0;i<20;i++){
        this$1.wallet.createKey(0).then(function (res){
          this$1.pool.watchAddress(res.getAddress('base58check'));  
          console.log("watching " + res.getAddress('base58check'));
        });
      }

    // Connect, start retrieving and relaying txs
    this$1.pool.connect().then(function() {
      // Start the blockchain sync.
      this$1.pool.startSync();

      this$1.pool.on('tx', function(tx) {
        this$1.walletdb.addTX(tx);
      });

      this$1.wallet.on('balance', function(balance) {
        console.log('Balance updated.');
        console.log(bcoin.amount.btc(balance.unconfirmed));
      });
    });
  });

  // var prom = new Promise(function (resolve, reject) {
  //   this$1.walletLocalFolder
  //     .folder(DATA_STORE_FOLDER)
  //     .file(DATA_STORE_FILE)
  //     .getText(DATA_STORE_FOLDER, 'walletLocalData')
  //     .then(function (result) {
  //       this$1.walletLocalData = new WalletLocalData(result);
  //       this$1.walletLocalData.masterPublicKey = this$1.keyInfo.keys.masterPublicKey;
  //       this$1.engineLoop();
  //       resolve();
  //     })
  //     .catch(function (err) {
  //       console.log(err);
  //       console.log('No walletLocalData setup yet: Failure is ok');
  //       this$1.walletLocalData = new WalletLocalData(null);
  //       this$1.walletLocalData.masterPublicKey = this$1.keyInfo.keys.masterPublicKey;
  //       this$1.walletLocalFolder
  //         .folder(DATA_STORE_FOLDER)
  //         .file(DATA_STORE_FILE)
  //         .setText(JSON.stringify(this$1.walletLocalData))
  //         .then(function (result) {
  //           this$1.engineLoop();
  //           resolve();
  //         })
  //         .catch(function (err) {
  //           console.log('Error writing to localDataStore:' + err);
  //           resolve();
  //         });
  //     });
  // });

  // return prom
};

ABCTxLibTRD.prototype.killEngine = function killEngine () {
  // disconnect network connections
  // clear caches

  this.engineOn = false;

  return true
};

// synchronous
ABCTxLibTRD.prototype.getBlockHeight = function getBlockHeight () {
  return this.walletLocalData.blockHeight
};

// asynchronous
ABCTxLibTRD.prototype.enableTokens = function enableTokens (tokens) {
    var this$1 = this;
    if ( tokens === void 0 ) tokens = [];

  for (var n in tokens) {
    var token = tokens[n];
    if (this$1.walletLocalData.enabledTokens.indexOf(token) !== -1) {
      this$1.walletLocalData.enabledTokens.push(token);
    }
  }
  // return Promise.resolve(dataStore.enableTokens(tokens))
};

// synchronous
ABCTxLibTRD.prototype.getTokenStatus = function getTokenStatus () {
  // return dataStore.getTokensStatus()
};

// synchronous
ABCTxLibTRD.prototype.getBalance = function getBalance (options) {
    if ( options === void 0 ) options = {};

  var currencyCode = PRIMARY_CURRENCY;
  if (options.currencyCode != null) {
    currencyCode = options.currencyCode;
  }

  return this.walletLocalData.totalBalances[currencyCode]
};

// synchronous
ABCTxLibTRD.prototype.getNumTransactions = function getNumTransactions (options) {
    if ( options === void 0 ) options = {};

  var currencyCode = PRIMARY_CURRENCY;
  if (options != null && options.currencyCode != null) {
    currencyCode = options.currencyCode;
  }
  return this.walletLocalData.transactionsObj[currencyCode].length
};

// asynchronous
ABCTxLibTRD.prototype.getTransactions = function getTransactions (options) {
    var this$1 = this;
    if ( options === void 0 ) options = {};

  var currencyCode = PRIMARY_CURRENCY;
  if (options != null && options.currencyCode != null) {
    currencyCode = options.currencyCode;
  }
  var prom = new Promise(function (resolve, reject) {
    var startIndex = 0;
    var numEntries = 0;
    if (options == null) {
      resolve(this$1.walletLocalData.transactionsObj[currencyCode].slice(0));
      return
    }
    if (options.startIndex != null && options.startIndex > 0) {
      startIndex = options.startIndex;
      if (
        startIndex >=
        this$1.walletLocalData.transactionsObj[currencyCode].length
      ) {
        startIndex =
          this$1.walletLocalData.transactionsObj[currencyCode].length - 1;
      }
    }
    if (options.numEntries != null && options.numEntries > 0) {
      numEntries = options.numEntries;
      if (
        numEntries + startIndex >
        this$1.walletLocalData.transactionsObj[currencyCode].length
      ) {
        // Don't read past the end of the transactionsObj
        numEntries =
          this$1.walletLocalData.transactionsObj[currencyCode].length -
          startIndex;
      }
    }

    // Copy the appropriate entries from the arrayTransactions
    var returnArray = [];

    if (numEntries) {
      returnArray = this$1.walletLocalData.transactionsObj[currencyCode].slice(
        startIndex,
        numEntries + startIndex
      );
    } else {
      returnArray = this$1.walletLocalData.transactionsObj[currencyCode].slice(
        startIndex
      );
    }
    resolve(returnArray);
  });

  return prom
};

// synchronous
ABCTxLibTRD.prototype.getFreshAddress = function getFreshAddress (options) {
    if ( options === void 0 ) options = {};

  // Algorithm to derive master pub key from master private key
  //master public key = "pub[masterPrivateKey]". ie. "pub294709fe7a0sb0c8f7398f"
  // Algorithm to drive an address from index is "[index]-[masterPublicKey]" ie. "102-pub294709fe7a0sb0c8f7398f"
  return this.addressFromIndex(this.walletLocalData.unusedAddressIndex)
};

// synchronous
ABCTxLibTRD.prototype.addGapLimitAddresses = function addGapLimitAddresses (addresses, options) {
    var this$1 = this;

  for (var i in addresses) {
    if (this$1.walletLocalData.gapLimitAddresses.indexOf(addresses[i]) === -1) {
      this$1.walletLocalData.gapLimitAddresses.push(addresses[i]);
    }
  }
};

// synchronous
ABCTxLibTRD.prototype.isAddressUsed = function isAddressUsed (address, options) {
    if ( options === void 0 ) options = {};

  var idx = this.findAddress(address);
  if (idx !== -1) {
    var addrObj = this.walletLocalData.addressArray[idx];
    if (addrObj != null) {
      if (addrObj.txids.length > 0) {
        return true
      }
    }
  }
  idx = this.walletLocalData.gapLimitAddresses.indexOf(address);
  if (idx !== -1) {
    return true
  }
  return false
};

// synchronous
ABCTxLibTRD.prototype.makeSpend = function makeSpend (abcSpendInfo) {
    var this$1 = this;

  // returns an ABCTransaction data structure, and checks for valid info
  var prom = new Promise(function (resolve, reject) {
    // ******************************
    // Get the fee amount
    var networkFee = 50000;
    if (abcSpendInfo.networkFeeOption === 'high') {
      networkFee += 10000;
    } else if (abcSpendInfo.networkFeeOption === 'low') {
      networkFee -= 10000;
    } else if (abcSpendInfo.networkFeeOption === 'custom') {
      if (
        abcSpendInfo.customNetworkFee == null ||
        abcSpendInfo.customNetworkFee <= 0
      ) {
        reject(new Error('Invalid custom fee'));
        return
      } else {
        networkFee = abcSpendInfo.customNetworkFee;
      }
    }

    // ******************************
    // Calculate the total to send
    var totalSpends = {};
    totalSpends[PRIMARY_CURRENCY] = 0;
    var outputs = [];
    var spendTargets = abcSpendInfo.spendTargets;

    for (var n in spendTargets) {
      var spendTarget = spendTargets[n];
      if (spendTarget.amountSatoshi <= 0) {
        reject(new Error('Error: invalid spendTarget amount'));
        return
      }
      var currencyCode = PRIMARY_CURRENCY;
      if (spendTarget.currencyCode != null) {
        currencyCode = spendTarget.currencyCode;
      }
      if (totalSpends[currencyCode] == null) {
        totalSpends[currencyCode] = 0;
      }
      totalSpends[currencyCode] += spendTarget.amountSatoshi;
      outputs.push({
        currencyCode: currencyCode,
        address: spendTarget.publicAddress,
        amount: spendTarget.amountSatoshi
      });
    }
    totalSpends[PRIMARY_CURRENCY] += networkFee;

    for (var n$1 in totalSpends) {
      var totalSpend = totalSpends[n$1];
      // XXX check if spends exceed totals
      if (totalSpend > this$1.walletLocalData.totalBalances[n$1]) {
        reject(new Error('Error: insufficient balance for token:' + n$1));
        return
      }
    }

    // ****************************************************
    // Pick inputs. Picker will use all funds in an address
    var totalInputAmounts = {};
    var inputs = [];
    var addressArray = this$1.walletLocalData.addressArray;
    // Get a new address for change if needed
    var changeAddress = this$1.addressFromIndex(
      this$1.walletLocalData.unusedAddressIndex
    );

    for (var currencyCode$1 in totalSpends) {
      for (var n$2 in addressArray) {
        var addressObj = addressArray[n$2];
        if (addressObj.amounts[currencyCode$1] > 0) {
          if (totalInputAmounts[currencyCode$1] == null) {
            totalInputAmounts[currencyCode$1] = 0;
          }

          totalInputAmounts[currencyCode$1] += addressObj.amounts[currencyCode$1];
          inputs.push({
            currencyCode: currencyCode$1,
            address: addressObj.address,
            amount: addressObj.amounts[currencyCode$1]
          });
        }
        if (totalInputAmounts[currencyCode$1] >= totalSpends[currencyCode$1]) {
          break
        }
      }

      if (totalInputAmounts[currencyCode$1] < totalSpends[currencyCode$1]) {
        reject(
          new Error('Error: insufficient funds for token:' + currencyCode$1)
        );
        return
      }
      if (totalInputAmounts[currencyCode$1] > totalSpends[currencyCode$1]) {
        outputs.push({
          currencyCode: currencyCode$1,
          address: changeAddress,
          amount: totalInputAmounts[currencyCode$1] - totalSpends[currencyCode$1]
        });
      }
    }

    // **********************************
    // Create the unsigned ABCTransaction
    var abcTransaction = new ABCTransaction(
      null,
      null,
      null,
      null,
      totalSpends[PRIMARY_CURRENCY],
      networkFee,
      null,
      { inputs: inputs, outputs: outputs }
    );

    resolve(abcTransaction);
  });
  return prom
};

// asynchronous
ABCTxLibTRD.prototype.signTx = function signTx (abcTransaction) {
  var prom = new Promise(function (resolve, reject) {
    abcTransaction.signedTx = 'iwassignedjusttrustme';
    resolve(abcTransaction);
  });

  return prom
};

// asynchronous
ABCTxLibTRD.prototype.broadcastTx = function broadcastTx (abcTransaction) {
    var this$1 = this;

  var prom = new Promise(function (resolve, reject) {
    this$1.fetchPost('spend', abcTransaction.otherParams)
      .then(function (response) {
        return response.json()
      })
      .then(function (jsonObj) {
        // Copy params from returned transaction object to our abcTransaction object
        abcTransaction.blockHeight = jsonObj.blockHeight;
        abcTransaction.txid = jsonObj.txid;
        abcTransaction.date = jsonObj.txDate;
        resolve(abcTransaction);
      })
      .catch(function (e) {
        reject(new Error('Error: broadcastTx failed'));
      });
  });
  return prom
};

// asynchronous
ABCTxLibTRD.prototype.saveTx = function saveTx (abcTransaction) {
  var prom = new Promise(function (resolve, reject) {
    resolve(abcTransaction);
  });

  return prom
};

exports.makeBitcoinPlugin = makeBitcoinPlugin;
//# sourceMappingURL=index.js.map
