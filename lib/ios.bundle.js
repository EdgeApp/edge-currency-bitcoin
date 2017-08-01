var masterCrypto = crypto = require('react-native-crypto');
var net = require('react-native-tcp');
var secp256k1 = require ('react-native-secp256k1');
var bcoin = require("./bcoin.js");

import { txLibInfo } from "./txLibInfo.js";

function hexToBytes(hex) {
  for (var bytes = new Buffer(hex.length/2), c = 0; c < hex.length; c += 2)
  bytes[c/2] = parseInt(hex.substr(c, 2), 16);
  return bytes;
}


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

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

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
       if (walletType === 'bitcoin') {
	        
	        var master = new bcoin.masterkey();

			mnemonic = new bcoin.mnemonic(null);
			var key = bcoin.hd.fromMnemonic(mnemonic, null);
			  
			master.fromKey(key, mnemonic);
			  
			var hex = master.key.privateKey.toString("base64");
			var mnemonic = master.mnemonic.phrase;

	        return { bitcoinKey: hex, mnemonic: mnemonic }
	      } else {
	        return null
	      }
    },

    makeEngine: function (keyInfo, opts) {
      // console.log("Key",keyInfo, "OPTS", opts);
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

var ABCTransaction = function ABCTransaction (txid, date, currencyCode, blockHeightNative, nativeAmount, nativeNetworkFee, signedTx, otherParams) {
  	this.txid = txid;
	this.date = date;
	this.currencyCode = currencyCode;
	this.blockHeightNative = blockHeightNative;
	this.blockHeight = 0,
	this.nativeAmount = nativeAmount;
	this.amountSatoshi = nativeAmount;
	this.nativeNetworkFee = nativeNetworkFee;
	this.networkFee = nativeNetworkFee;
	this.signedTx = signedTx;
	this.otherParams = otherParams;
};



var ABCTxLibTRD = function ABCTxLibTRD (io, keyInfo, opts) {
  if ( opts === void 0 ) opts = {};

  // dataStore.init(abcTxLibAccess, options, callbacks)
  var walletLocalFolder = opts.walletLocalFolder;
  var callbacks = opts.callbacks;

  // console.log(callbacks);

  this.io = io;
  this.keyInfo = keyInfo;
  this.abcTxLibCallbacks = callbacks;
  this.walletLocalFolder = walletLocalFolder;
  this.connections = [];
  this.walletsScanQueue = [];
  this.transactionsStash = [];
  this.transactionHistory = {};
  this.transactionTS = {};
  this.increasingLimitLoop = 0;
  this.watchAhead = 10;
  this.addressLimitLoop = 0;
  this.txUpdateTotalAddresses = 0;
  this.txUpdateStarted = false;
  this.txUpdateTotalEntries = 0;
  this.txUpdateFinished = false;
  this.txBalanceUpdateTotal = 0;
  this.addressHashMap = {};
  this.txBalanceUpdateProgress = 0;
  this.txBalanceUpdateFinished = 0;
  this.txUpdateMonitoring = {};
  this.hashUpdateMonitoring = {};
  this.engineOn = false;
  this.transactionsDirty = true;
  this.totalPercentageCombined = 0;
  this.addressesChecked = false;
  this.numAddressesChecked = 0;
  this.numAddressesToCheck = 0;
  this.walletLocalData = {};
  this.walletLocalDataDirty = false;
  this.transactionsChangedArray = [];
  this.masterBalance = 0;
  this.electrumServers = [["h.1209k.com","50001"],["electrum-bu-az-weuro.airbitz.co","50001"],["electrum-bc-az-eusa.airbitz.co","50001"],["electrum-bu-az-ausw.airbitz.co","50001"],["electrum.hsmiths.com","8080"],["e.anonyhost.org","50001"],["electrum.no-ip.org","50001"],["electrum-bu-az-wusa2.airbitz.co","50001"],["ELECTRUM.not.fyi","50001"],["electrum.jdubya.info","50001"],["electrum-bu-az-wjapan.airbitz.co","50001"],["kerzane.ddns.net","50001"]];
  this.globalRecievedData = ["","","","","","","","","",""];
  this.addresses = [];
  this.masterFee = 0;
  this.masterFeeReuqested = 0;
  this.masterFeeRecieved = 0;


  this.logger = new bcoin.logger({ level: 'debug', console: true });

  this.logger.writeConsole = function(level, module, args) {
    // console.log(level,module,args);
    if (level == 4 && module == "net" && args[0].substring(0,6) == "Status"){
      console.log("SPV SYNC PROGRESS: ", args[3]);
    } 
  };

  this.logger.info = function(level, module, args) {
    // console.log(level,module,args);
  };

  this.logger.open();
 
  // this.walletdb = new bcoin.walletdb({ db: 'leveldb', location: 'db/mywalletTest1' });
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


ABCTxLibTRD.prototype.setupConnectionBindings = function (one,two,three){
	var this$1 = this;
	for (var i in this.connections){
		console.log("one,two,three: ", one, two, three);
		if (this.connections[i].conn.readable && this.connections[i].conn.writable && !this.connections[i].binded){
			this.connections[i].binded = true;

			function makeCallback(i) {
				return function(data){
			        var string = "";
					for (var ui=0;ui<=data.length-1;ui++){
					  string+=String.fromCharCode(data[ui]);
					}
					console.log(string);

			        this$1.rescan(data,i);
			    }
			}
			function makeReconnectionCallback(i) {
				return function(data){
			        console.log("EMMITED CLOSE/END");
			        console.log("reconnecting to ELECTRUM",this$1.electrumServers[i]);
			        try {
			        	var connection = net.connect(this$1.electrumServers[i][1], this$1.electrumServers[i][0], function() {this$1.setupConnectionBindings()});
						this$1.connections[i] = {
							conn: connection,
							binded: false
					  	};
			        } catch(e){ console.log("ERROR AFTER CLOSE/END event",e); }
			        
			      }
			}
			const callback = makeCallback(i);
			const reconnectionCallback = makeReconnectionCallback(i);

			this.connections[i].conn.on("data",callback);

	      this.connections[i].conn.on("close",reconnectionCallback);

	      this.connections[i].conn.on("error",function(data){
	        console.log("EMMITED ERROR", data);
	      });

	      this.connections[i].conn.on("onerror",function(data){
	        console.log("EMMITED onERROR", data);
	      });

	      this.connections[i].conn.on("end",reconnectionCallback);

	      if (!this.masterFeeRecieved && !this.masterFeeReuqested){
	      	var feeRequestString = '{ "id": "fee", "method":"blockchain.estimatefee", "params":[ 2 ] }';
			this.connections[i].conn.write(feeRequestString+"\n");    
			this.masterFeeReuqested = 1;
			
			console.log("FEEREQUESTED");

			this.rescan(0,i);

		      setTimeout(function(){
		        this$1.collectGarbage();
		      }, 1200);

		    }
		}
	}
}

ABCTxLibTRD.prototype.tcpClientConnect = function (){

	this.connections = [];
 
	for (var i in this.electrumServers){

		var this$1 = this;

		var conn = {};

		try {

			console.log("NET CONNECTION ", this.electrumServers[i]);

			var connection = net.connect(this.electrumServers[i][1], this.electrumServers[i][0], function() {this$1.setupConnectionBindings()});

			this$1.connections.push(conn);

			this$1.connections[i] = {
				conn: connection,
				binded: false
		  	};	
		} catch(e){
			console.log("NET ERROR", e);
		}

	}

}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

ABCTxLibTRD.prototype.tcpClientWrite = function (data){ 
	var total = 0;
	for (var i in this.connections){
		if (this.connections[i].binded)
			total++;
	}
	var this$1 = this;
	var randomIndex = getRandomInt(1,total);
	var total = 0;
	for (var j in this.connections){
		if (this.connections[j].binded){
			total++;
		}
		if (total == randomIndex){
			console.log("writting DATA into socket:",randomIndex, data);
			if ( (!this.connections[j].conn.readable || !this.connections[j].conn.writable) && this.connections[j].conn.binded){

				console.log("reconnecting to ELECTRUM",this.electrumServers[j][1]);
				try {
					var connection = net.connect(this.electrumServers[j][1], this.electrumServers[j][0], function() {this$1.setupConnectionBindings()});

					this.connections[j] = {
						conn: connection,
						binded: false
				  	};
				  	this.tcpClientWrite(data);
				} catch(e){
					console.log("ERROR WHILE RECCONNECTING on the fly: ",e);
				}
				
			} else {
				
				try{
					this.connections[j].conn.write(data);		
				} catch(e){
					console.log("Silly connection error: ",this.connections[j].conn,e);	
				}
				
			}
			break;
		}
	}
}

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

ABCTxLibTRD.prototype.handleHashMapTransaction = function (data){

	this.hashUpdateMonitoring[data.id].executed = true;

	this.wallet.db.addTXFromRaw(data.result);

}

ABCTxLibTRD.prototype.updateAddressHistory = function (address){

	console.log("Requesting transaction history", address);

	var requestID = "ah"+address;
	var requestString = '{ "id": "'+requestID+'", "method":"blockchain.address.get_history", "params":["'+address+'"] }';
    this.tcpClientWrite(requestString+"\n");

    this.hashUpdateMonitoring[requestID] = {
		requestTime: Date.now(),
		requestResult: false,
		requestString: requestString,
		executed: false
	};

}


ABCTxLibTRD.prototype.updateAddressTransactions = function (data){

	this.hashUpdateMonitoring[data.id].executed = true;

	if (data.result.length>0){
      for (var j=0;j<=data.result.length-1;j++){
        
        console.log("Requesting 127773 transaction", data.result[j]);
        
        var requestID = "at"+data.result[j].tx_hash;
        var requestString = '{ "id": "'+requestID+'", "method":"blockchain.transaction.get", "params":["'+data.result[j].tx_hash+'"] }';

        this.tcpClientWrite(requestString+"\n");
        this.hashUpdateMonitoring[requestID] = {
          requestTime: Date.now(),
          requestResult: false,
          requestString: requestString,
          executed: false
        };
      } 
    }	
}

ABCTxLibTRD.prototype.processAddressHistoryHash = function (data){
	var hash = data.result;

	this.hashUpdateMonitoring[data.id].executed = true;

	if (this.addressHashMap[data.id].new){
		this.addressHashMap[data.id].hash = hash;
		this.addressHashMap[data.id].new = 0;
	}

	if (this.addressHashMap[data.id].hash != hash){
		this.addressHashMap[data.id].hash = hash;
		this.updateAddressHistory(this.addressHashMap[data.id].address);
	}

}

ABCTxLibTRD.prototype.handleData = function(data){

  if (!data.id)
  	return;

  if (data.id=="fee"){
    this.masterFee = data.result;
    this.masterFeeRecieved = 1;
    console.log("GOTFEE!!!!", this.masterFee);
    return;
  }

  if (data.id=="txsend"){
    txsent = data.result;
    console.log("TX SENT! HASH:", txsent);
    return;
  }

  if (data.id=="newtx"){
  	console.log("INCOMING TX",data);
  	this.wallet.db.addTXFromRaw(data.result);
  	return;
  }

  if (data.id.substring(0,3)=="sub"){
  		console.log("Subscribed to address result hash: ",data.result, this.hashUpdateMonitoring[data.id]);
  		this.processAddressHistoryHash(data);
        return;
  }

  if (data.id.substring(0,2)=="ah"){
  		console.log("GOT Changed Transaction history: ",data.result, this.hashUpdateMonitoring[data.id]);
  		this.updateAddressTransactions(data);
        return;
  }

  if (data.id.substring(0,2)=="at"){
  		console.log("GOT Transaction: ",data.result, this.hashUpdateMonitoring[data.id]);
  		this.handleHashMapTransaction(data);
        return;
  }

  if (!data.result)
  	return;

  if (!this.txUpdateMonitoring[data.id]){
    console.log(data);
    return;
  }

  if (this.txUpdateMonitoring[data.id].executed){
    console.log("FUCK REPEATS!!!");
    return;
  }

  if (data.id.substring(0,1)=="h"){
    
    this.txUpdateMonitoring[data.id].executed = Date.now();
    this.txUpdateMonitoring[data.id].requestResult = data.result;

    var walletAddress = data.id.substring(1);

    var walletIndex = this.addresses.indexOf( walletAddress );
    if ((walletIndex+this.watchAhead+1 > (this.addresses.length+this.addressLimitLoop) && data.result.length>0)){
      this.addressLimit = walletIndex+this.watchAhead+1;
      this.addressLimitLoop = this.addressLimit - this.addresses.length - this.addressLimitLoop;
      console.log("INCREMENTING",this.addresses.length, this.addressLimitLoop)
      this.incrementWatchList(this.addressLimitLoop);
    }

    console.log("GOT TRANSACTIONS <<<", data, walletAddress, this.addressLimitLoop  );

    if (data.result.length>0){
      for (var j=0;j<=data.result.length-1;j++){
        
        console.log("Requesting 126663 transaction", data);
        console.log("Total transactions", this.transactionsStash.length );
        
        var requestID = "t"+data.result[j].tx_hash;
        var requestString = '{ "id": "'+requestID+'", "method":"blockchain.transaction.get", "params":["'+data.result[j].tx_hash+'"] }';

        this.transactionsStash.push(data.result[j].tx_hash);

        this.tcpClientWrite(requestString+"\n");
        this.txUpdateMonitoring[requestID] = {
          requestTime: Date.now(),
          requestResult: '',
          requestString: requestString,
          transactionHash: data.result[j].tx_hash,
          transactionHeight: data.result[j].height,
          executed: 0
        };
      } 
    }
  }
  if (data.id.substring(0,1)=="t"){
    console.log("GOT 125553 DATA", data);
    
    this.txUpdateMonitoring[data.id].executed = Date.now();
    this.txUpdateMonitoring[data.id].requestResult = data.result;
    
    
    // console.log(bcoin.tx);
    // var dataTX = JSON.parse(r);
    
    // if (data.id==16)
    //   return;
    // for (var y=0;y<=dataTX.inputs.length-1;y++){
    //   tcpClientWrite('{ "id": 16, "method":"blockchain.transaction.get", "params":["'+dataTX.inputs[y].prevout.hash+'"] }'+"\n");   
    // }
    // console.log("TX HASHES!!:",data.result);   
    return;
  } 
}
 
ABCTxLibTRD.prototype.rescan = function(data,index){
  if (data!=0){

    var string = "";
    for (var ui=0;ui<=data.length-1;ui++){
      string+=String.fromCharCode(data[ui]);
    }
    this.globalRecievedData[index] += string;
    var result = [];
    if (this.globalRecievedData[index].indexOf("\n")>-1){
      // console.log("stringbeforesplit ",this.globalRecievedData[index]); 
      var mdata = this.globalRecievedData[index].split("\n");
      for (var k=0;k<=mdata.length-1;k++){
        if (mdata[k].length<3){
          continue;
        }
        // console.log("ssbefore parsing, mk ",mdata[k]);   
        var res = false;
        try{
          res = JSON.parse(mdata[k]);
          result.push(res);
        } catch(e){}
      }
    } else {
      // console.log("ssbefore parsing, s ",this.globalRecievedData[index]);   
      try{
        data = JSON.parse(this.globalRecievedData[index]);
        result.push(data);
      } catch(e){
        console.log("parse error",e);
      }
    } 
    if (result.length>0){
      this.globalRecievedData[index] = "";
    }
    for (var o=0;o<=result.length-1;o++){
      this.handleData(result[o]);  
    }
  }

  if (this.walletsScanQueue.length==0)
    return;
 
  var wallet = this.walletsScanQueue.shift();
  var requestID = "h"+wallet;
  // console.log("JOINING, ",wallet);
  // walletsScanQueue = [];
  var requestString = '{ "id": "'+requestID+'", "method":"blockchain.address.get_history", "params":["'+wallet+'"] }';
  
  this.tcpClientWrite(requestString+"\n");  

  this.txUpdateMonitoring[requestID] = {
    requestTime: Date.now(),
    requestResult: '',
    requestString: requestString,
    executed: 0
  };

  // var client = net.connect("50001", "cluelessperson.com", function(res) {
  //   console.log('opened client on ' + JSON.stringify(client.address()));
  //   client.write('{ "id": 1, "method":"blockchain.address.get_balance", "params":["'+address+'"] }'+"\n");
  //   client.on("data",function(data){
  //     
  //     console.log("zzszincomming, ",string);  
  //     data = JSON.parse(string);
  //   console.log("zzzincomming, ",data);   
  //   })
  //   // client.write('Hello, server! Love, Client.');
  // });
}


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

ABCTxLibTRD.prototype.subscribeToUpdates = function(){
	this.hashUpdateInProgress = 1;
	for (var i in this.addressHashMap){
		console.log("Subscribing to ", this.addressHashMap[i].address);
		var requestString = '{ "id": "'+i+'", "method":"blockchain.address.subscribe", "params": ["'+ this.addressHashMap[i].address+'"] }';
		this.tcpClientWrite(requestString+"\n");    	

		this.hashUpdateMonitoring[i] = {
			requestTime: Date.now(),
			requestResult: false,
			requestString: requestString,
			executed: false
		};
	}
	var this$1 = this;
	setTimeout(function(){
	    this$1.collectAddressGarbage();
	  }, 500);
};


ABCTxLibTRD.prototype.collectAddressGarbage = function(){
  if (!this.hashUpdateInProgress)
    return;
  
  var executedCount = 0;
  var totalExecutedCount = 0;
  var totalCount = 0;

  var lastRequest = 3500;

  for (var i in this.hashUpdateMonitoring){
    totalCount++;
    

    if (!this.hashUpdateMonitoring[i].executed && (Date.now() - this.hashUpdateMonitoring[i].requestTime) > 5000){
      this.tcpClientWrite(this.hashUpdateMonitoring[i].requestString+"\n");
      console.log("RE-Requesting ", i,this.hashUpdateMonitoring[i].requestString);
      this.hashUpdateMonitoring[i].requestTime = Date.now();
    }

    if (this.hashUpdateMonitoring[i].executed){
    	var delta = Date.now() - this.hashUpdateMonitoring[i].requestTime;

	    if (delta<lastRequest){
	      lastRequest = delta;
	    }
      totalExecutedCount++;
    }
  }

  var totalPercentageCompleted = ((totalExecutedCount / totalCount)).toFixed(2);

  console.log("Progress", totalPercentageCompleted, "%", "Total: ", totalCount, "Executed:", totalExecutedCount);
  
  var this$1 = this;

  if (totalExecutedCount == totalCount && totalCount > 0){
  	this.hashUpdateInProgress = 0;

  	setTimeout(function(){
  		console.log("REFRESHING Balance 10 SEC");
	    this$1.refreshBalanceElectrum();
	  }, 10000);
    return;
  }

  

  if (lastRequest == 3500 && totalCount > 0){
    console.log("EPIC RECONNECT...");
    
    this.tcpClientConnect();
	    setTimeout(function(){
	    this$1.collectAddressGarbage();
	  }, 1000);

	    return;

  }

  setTimeout(function(){
    this$1.collectAddressGarbage();
  }, 500);

}

ABCTxLibTRD.prototype.collectGarbage = function(){
  if (this.txUpdateFinished)
    return;
  
  var executedCount = 0;
  var totalExecutedCount = 0;
  var totalCount = 0;

  var lastRequest = 3500;

  for (var i in this.txUpdateMonitoring){
    totalCount++;
    

    if (!this.txUpdateMonitoring[i].executed && (Date.now() - this.txUpdateMonitoring[i].requestTime) > 5000){
      this.tcpClientWrite(this.txUpdateMonitoring[i].requestString+"\n");
      console.log("RE-Requesting ", i,this.txUpdateMonitoring[i].requestString);
      this.txUpdateMonitoring[i].requestTime = Date.now();
    }
    if (this.txUpdateMonitoring[i].executed && i.substring(0,1) == "h" ){
      executedCount++;
    }
    if (this.txUpdateMonitoring[i].executed){
    	var delta = Date.now() - this.txUpdateMonitoring[i].requestTime;

	    if (delta<lastRequest){
	      lastRequest = delta;
	    }
      totalExecutedCount++;
    }
  }

  var percentageCompleted = ((executedCount / this.txUpdateTotalEntries)).toFixed(2);
  var totalPercentageCompleted = ((totalExecutedCount / totalCount)).toFixed(2);
  var totalPercentageCombined = (0.98*percentageCompleted*totalPercentageCompleted).toFixed(5);

  if (this.totalPercentageCombined < totalPercentageCombined){
    this.totalPercentageCombined = totalPercentageCombined;
  }

  if (this.abcTxLibCallbacks["onAddressesChecked"]){
    this.abcTxLibCallbacks.onAddressesChecked(this.totalPercentageCombined);
  }
  console.log("Progress", this.totalPercentageCombined, "%");
  
  

  if (totalExecutedCount == totalCount && totalCount > 0){
    return this.processElectrumData();
  }

  var this$1 = this;

  if (lastRequest == 3500 && totalCount > 0){
    console.log("EPIC RECONNECT...");
   
       this.tcpClientConnect();
       setTimeout(function(){
	    	this$1.collectGarbage();
	  	}, 1000);

    return;
  }

  setTimeout(function(){
    this$1.collectGarbage();
  }, 200);

}


ABCTxLibTRD.prototype.refreshBalanceElectrum = function(){
	this.buildHashMap();
	this.subscribeToUpdates();
}

ABCTxLibTRD.prototype.buildHashMap = function (){
	var id = "";
	for (var i in this.addresses){
		
		id = "sub"+i.toString();
		if (this.addressHashMap[id])
			continue;
		
		this.addressHashMap[id] = {
			address: this.addresses[i],
			hash: null,
			new: 1
		}
	
	}
}

ABCTxLibTRD.prototype.refreshTransactionHistory = function (){
	var this$1 = this;
	return this.wallet.getHistory().then(function (res){
      	var transactionList = [];
          for (var i in res){
            var tx = res[i].tx;
            var inputs = tx.inputs;
            var address;
            var hash = tx.txid();
            if (this$1.transactionHistory[hash]){
            	continue;
            }
            // console.log("inputs ==> ", inputs);
            var outgoingTransaction = false;
            var totalAmount = 0;
            for (var j in inputs){
              address = inputs[j].getAddress().toBase58();
              var addressIndex = this$1.addresses.indexOf(address);
              if (addressIndex>-1){
                outgoingTransaction = true;
              }
              // console.log("I>>",address );
            }
            var outputs = tx.outputs;
            // console.log("OUTPUTS ==> ", outputs);
            for (var j in outputs){
              
              address = outputs[j].getAddress().toBase58();
              var addressIndex = this$1.addresses.indexOf(address);
              if ( (addressIndex==-1 && outgoingTransaction) || (!outgoingTransaction && addressIndex>-1)){
                totalAmount+=outputs[j].value;
              }
              // console.log("O>",address, "V>",outputs[j].value );
            }

            var d = Math.floor(Date.now()/1000);
            totalAmount = (outgoingTransaction)?-totalAmount:totalAmount;

            var t = new ABCTransaction (hash, d, "BTC", 1, totalAmount, 10000, "signedTx", {});

            this$1.transactionHistory[hash] = t;
            
            transactionList.push(t);

            // console.log("Transaction type",(outgoingTransaction)?"Spending":"Incoming", "Amount:", totalAmount);
          }
          // console.log("TOTAL TRANSACTIONS LIST", transactionList);
          if (this$1.abcTxLibCallbacks.onTransactionsChanged){
          	this$1.abcTxLibCallbacks.onTransactionsChanged(transactionList)
          }
          // return transactionList;
  });
}

ABCTxLibTRD.prototype.processElectrumData = function () {
    
    // console.log("Start Electrum Update Process");

    var txMappedTxList = [];

    function sortMappedList(list){
      var _fl = 0;
      var a = {};

      for (var _i=0; _i<=list.length-2;_i++){
        for (var _j=_i+1; _j<=list.length-1;_j++){
          _fl = 0;
          for (var _o=0;_o<=list[_i].prevOuts.length-1;_o++){
            if (list[_i].prevOuts[_o]==list[_j].hash){
              _fl = 1;
            }
          }
          if (_fl){
            a = list[_i];
            list[_i] = list[_j];
            list[_j] = a;
            _j=_i+1;
          }
        }
      }
    }

    for (var i in this.txUpdateMonitoring){
      if (i.substring(0,1)=="h"){
        continue;
      }
      var data = this.txUpdateMonitoring[i].requestResult;
      var hash = this.txUpdateMonitoring[i].transactionHash;

      var prevOuts = [];
      var txd = hexToBytes(data);
      var tx = bcoin.tx.fromRaw(txd);
      var txjson = tx.toJSON();

      for (var k=0;k<=txjson.inputs.length-1;k++){
        prevOuts.push(txjson.inputs[k].prevout.hash);
        // console.log("TXData: ",txjson.inputs[k].prevout.hash);  
      }

      txMappedTxList.push({
        prevOuts: prevOuts,
        data: data,
        hash: hash
      })

     

      // var txd = hexToBytes(this.txUpdateMonitoring[i].requestResult);

      // var tx = new bcoin.tx.fromRaw(txd);
      // console.log(tx);
      //var r = this.wallet.db.addTXFromRaw(this.txUpdateMonitoring[i].requestResult);
    }

    sortMappedList(txMappedTxList);
    
    var this$1 = this;

    this.txBalanceUpdateTotal = txMappedTxList.length;

    



    for (var j in txMappedTxList){
    	// console.log("IN!!!", j);
      
      this.wallet.db.addTXFromRaw(txMappedTxList[j].data).then(function(){
        this$1.txBalanceUpdateProgress++;
        var totalPercentageCombined = 0.98 + 0.02*(this$1.txBalanceUpdateProgress/this$1.txBalanceUpdateTotal);

        if (this$1.totalPercentageCombined < totalPercentageCombined && totalPercentageCombined<=1){
          this$1.totalPercentageCombined = totalPercentageCombined;
          if (this$1.abcTxLibCallbacks["onAddressesChecked"]){
            this$1.abcTxLibCallbacks.onAddressesChecked(this$1.totalPercentageCombined);
          }
          console.log("Progress", this$1.totalPercentageCombined, "%");
        }

        if (this$1.totalPercentageCombined==1){
          this$1.txBalanceUpdateFinished = 1;
          	console.log("ELECTRUM SUBSCRIBE");
          	this$1.refreshBalanceElectrum();

			    
          
          this$1.wallet.getBalance(0).then(function(result){
              // console.log("Balance======>",result);
              console.log("Final Balance: ",bcoin.amount.btc(result.unconfirmed+result.confirmed));
              this$1.masterBalance = result.confirmed + result.unconfirmed;
              this$1.abcTxLibCallbacks.onBalanceChanged("BTC",this$1.masterBalance);

              this$1.refreshTransactionHistory();

              	////SENDING FOR TESTING....
       //        if (this$1.masterBalance < 100000)
	      //     	return;

	      //     var fee = parseInt(this$1.masterFee*100000000);

	      //     var options = {
			    //   outputs: [{
			    //     address: "1LwKgnNSkyWBpyuaJxWWHFWGTQ47wNCgAY",
			    //     value: 10000
			    //   }],
			    //   rate: fee
			    // };
			    // console.log("signing", options);
			    
			    // return this$1.wallet.send(options).then(function(tx) {
			    //   console.log("after TX CREATED", tx);
			    //   // Need to pass our passphrase back in to sign
			 
			    //   var rawTX = tx.toRaw().toString("hex");
			    //   console.log('RAW tx:',rawTX);
			    //   // console.log('Fee:',tx.getFee());

			    //   // request.post({ url:'https://insight.bitpay.com/api/tx/send', form: {rawtx:rawTX} }, function(err,httpResponse,body){ 
			    //   //   console.log("Transaction status", body)
			    //   // })
			    //   return;
			    //   // return this$1.pool.broadcast(tx);

			    // }).then(function() {
			    //   console.log('tx sent!');
			    // });



          });  
          

        }

      });
      
    }

    if (this.txBalanceUpdateTotal==0){
      // this.txBalanceUpdateFinished = 1;
      // this$1.totalPercentageCombined = 1;
      if (this$1.abcTxLibCallbacks["onAddressesChecked"]){
        this$1.abcTxLibCallbacks.onAddressesChecked(1);
      }

      this$1.refreshBalanceElectrum();
		// this$1.masterBalance = 12323;
      this$1.abcTxLibCallbacks.onBalanceChanged("BTC", 12323);

      console.log("CALLED BALANCE");
    }

   
    // var s = JSON.stringify(result);
    // fs.writeFileSync("res.txt",s);

    this.txUpdateFinished = true;
}
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

ABCTxLibTRD.prototype.incrementWatchList = function (number){
  var this$1 = this;
  for (var i=0;i<number;i++){
    this$1.addressLimitLoop--;
    this.wallet.createKey(0).then(function (res){
      this$1.txUpdateTotalEntries++;
      var address = res.getAddress('base58check');
      this$1.addresses.push(address);
      this$1.walletsScanQueue.push(address);
      if (this$1.addresses.length>=this$1.addressLimitLoop){
        this$1.increasingLimitLoop=0;
      }
    });
  }
  
}

// *************************************
// Public methods
// *************************************

ABCTxLibTRD.prototype.startEngine = function startEngine () {
  var this$1 = this;

  

  function hexToBytes(hex) {
    for (var bytes = new Buffer(hex.length/2), c = 0; c < hex.length; c += 2)
    bytes[c/2] = parseInt(hex.substr(c, 2), 16);
    return bytes;
  }


  
  return this$1.walletdb.open().then(function() {

    // var w = new bcoin.hd.PrivateKey()
    // // w.fromSeed("9f8c2359d1581ecc861600306a647f98b0bcfa258de9ece3a124ae1499988503")
    // w.fromSeed("5ad1fd622f79236309614c85c39b32b7999ef2ae175872e683c317db7375af5a")
    // // 5ad1fd622f79236309614c85c39b32b7999ef2ae175872e683c317db7375af5a
    // var key = w.toJSON()
    
    console.log("KEYINFO",this$1.keyInfo);

    if (typeof this$1.keyInfo.keys.bitcoinKey == "undefined"){
    	console.log("KEY FORMAN VIOLATION!!!! keyInfo.keys.bitcoinKey ", this$1.keyInfo);
    	return false;
    }

    var w = new bcoin.hd.PrivateKey()
    
    var b = new Buffer (this$1.keyInfo.keys.bitcoinKey, "base64");
    // var b = new Buffer ("q+Wwrz1uM0yr+CWcubNKyfGRi8ftSi2wAv+tGh4vpJw=", "base64");
    var hex = b.toString("hex");

    // console.log("======== .>>>>", this$1.keyInfo.keys.bitcoinKey);
    // console.log("======== .>>>>", hex);
    // console.log("======== .>>>>", b.toString("hex"));
    
    w.fromSeed(hex)
    
    var key = w.toJSON()
    
    console.log("XPRIV", key.xprivkey);

    return this$1.walletdb.create({
        "master": key.xprivkey,
        "id": "AirBitzMain"
      });
  })
  .then(function(wallet) {
    // console.log(wallet.account.keys);

    // console.log("Root m/0/0/0 => "+);
    this$1.wallet = wallet;

    // console.log("MASTER WALLET", wallet);
    // this$1.masterWallet = wallet.getID()
      // console.log('Main address: '+ wallet.getAddress('base58check'));
      // console.log("RECIEVE DEPTH: ", this$1.wallet.account.receiveDepth);
    // Add our address to the spv filter.
      
    // wallet.getBalance(0).then(function(result){
    //     // console.log("Balance======>",result.confirmed);
    //     this$1.masterBalance = result.confirmed+result.unconfirmed;
    // });
      // console.log("Generating 1000 nearest addresses");
    this$1.wallet.getAccountPaths(0).then(function(result){

      var a;
      for (var i in result){
        a = result[i].toAddress();

        // console.log("Paths======>",a.toString());
        this$1.addresses.push(a.toString());
        this$1.walletsScanQueue.push(a.toString());
        this$1.txUpdateTotalAddresses++;
      }

            
            // Start the blockchain sync.


            // this$1.txUpdateStarted = Date.now();
		 this$1.txUpdateTotalEntries = this$1.addresses.length;
              
		 this$1.tcpClientConnect();
		  
         
      // process.exit();
    // Connect, start retrieving and relaying txs
     });

    this$1.wallet.on('balance', function(balance) {
      // console.log('Balance updated.',this$1.txBalanceUpdateTotal, this$1.txBalanceUpdateProgress);
      if (this$1.txBalanceUpdateFinished){
        
        console.log("STABLE TOP : ",bcoin.amount.btc(balance.unconfirmed));
        this$1.masterBalance = balance.confirmed + balance.unconfirmed;
        this$1.abcTxLibCallbacks.onBalanceChanged("BTC", this$1.masterBalance);

      } else {
        console.log("UNSTABLE TOP : ",bcoin.amount.btc(balance.unconfirmed));
      }
            // console.log("Balance======>",result);
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
 
  
  var this$1 = this;

  setTimeout(function(){
    this$1.collectGarbage();
  }, 200);
  
  this.wallet.getBalance(0).then(function(result){
      // console.log("Balance======>",result.confirmed);
      this$1.masterBalance = result.confirmed+result.unconfirmed;
  });

  return this.masterBalance;
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
  // return this$1.wallet.createKey(0).then(function(res){
  //   return res.getAddress('base58check');
  // });
  // return this.masterWallet;
  if (this.addresses.length > this.wallet.account.receiveDepth)
  {
    var this$1 = this;
    this.wallet.createKey(0).then(function (res){
      // console.log(this$1.wallet.getAccount()); 
      // console.log("watching " + res.getAddress('base58check'));
      this$1.addresses.push(res.getAddress('base58check'));
    });
    return this.addresses[this.wallet.account.receiveDepth];
  }
  // return this.addressFromIndex(this.walletLocalData.unusedAddressIndex)
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

ABCTxLibTRD.prototype.fetchTransactions = function fetchTransactions () {

}

// synchronous
ABCTxLibTRD.prototype.makeSpend = function makeSpend (abcSpendInfo) {
    
   

    // console.log();
    // return;
    //1BynMxKHRyASZDNhX4q6pRtdzAb2m8d7jM

    //1DDeAGCAikvNemUHqCLJGsavAqQYfv5AbX

    // return;
  // returns an ABCTransaction data structure, and checks for valid info
  var prom = new Promise(function (resolve, reject) {


    var fee = parseInt(this.masterFee*100000000)*0.3;

    var outputs = [];

    outputs.push({
      currencyCode: "BTC",
      address: abcSpendInfo.spendTargets[0].publicAddress,
      amount: parseInt(abcSpendInfo.spendTargets[0].amountSatoshi)
    });
    

    const abcTransaction = new ABCTransaction('', // txid
	    0, // date
	    "BTC", // currencyCode
	    '0', // blockHeightNative
	    abcSpendInfo.spendTargets[0].amountSatoshi, // nativeAmount
	    fee.toString(), // nativeNetworkFee
	    '0', // signedTx
	    {outputs: outputs} // otherParams
	    );

    resolve(abcTransaction);
  });
  return prom
};

// asynchronous
ABCTxLibTRD.prototype.signTx = function signTx (abcTransaction) {
	
  var this$1 = this;
  var prom = new Promise(function (resolve, reject) {


  	 	var fee = parseInt(this$1.masterFee*100000000);

	    var options = {
	      outputs: [{
	        address: abcTransaction.otherParams.outputs[0].address,
	        value: parseInt(abcTransaction.otherParams.outputs[0].amount)
	      }],
	      rate: fee
	    };

	    console.log("signing", options);
	    
	    return this$1.wallet.send(options).then(function(tx) {
	      
	      console.log("after TX CREATED", tx);
	      // Need to pass our passphrase back in to sign



	      var rawTX = tx.toRaw().toString("hex");

	      console.log('RAW tx:',rawTX);

	      abcTransaction.date = Date.now() / 1000;
	      abcTransaction.signedTx = rawTX;
	      
	      resolve(abcTransaction);


	      // request.post({ url:'https://insight.bitpay.com/api/tx/send', form: {rawtx:rawTX} }, function(err,httpResponse,body){ 
	      //   console.log("Transaction status", body)
	      // })
	      
	      // return this$1.pool.broadcast(tx);

	    });
  });

  return prom
};

// asynchronous
ABCTxLibTRD.prototype.broadcastTx = function broadcastTx (abcTransaction) {
  
  var this$1 = this;

  var prom = new Promise(function (resolve, reject) {
     var requestString = '{ "id": "txsend", "method":"blockchain.transaction.broadcast", "params":["'+abcTransaction.signedTx+'"] }';

      this$1.tcpClientWrite(requestString+"\n");
      
      console.log("\n"+requestString+"\n");

      resolve(abcTransaction);

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

module.exports.makeBitcoinPlugin = makeBitcoinPlugin;
