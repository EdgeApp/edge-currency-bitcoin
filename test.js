var bcoin = require('bcoin');

var logger = new bcoin.logger({ level: 'debug', console: true });

logger.writeConsole = function(level, module, args) {
  console.log(level,module,args);
  // if (level == 4 && module == "net" && args[0].substring(0,6) == "Status"){
  //   console.log("PROGRESS: ", args);
  // } 
};

logger.info = function(level, module, args) {
  console.log(level,module,args);
};

logger.open();

var chain = new bcoin.chain({
  db: 'leveldb',
  location: process.env.PWD + "/db" + '/spvchain14967688000312',
  spv: true,
  network: "main",
  logConsole: true,
  logger: logger
});

var pool = new bcoin.pool({
  chain: chain,
  spv: true,
  maxPeers: 8 ,
  logger: logger
});


var walletdb = new bcoin.walletdb({ db: 'leveldb', location: process.env.PWD + "/db" + '/wallet12' });

pool.open().then(function() {
  return walletdb.open();
}).then(function() {

  var w = new bcoin.hd.PrivateKey()
  w.fromSeed("5ad1fd622f79236309614c85c39b32b7999ef2ae175872e683c317db7375af5a")
  var key = w.toJSON()
  
  console.log("XPRIV", key.xprivkey);

  return walletdb.create({
      "master": key.xprivkey,
      "id": "AirBitzMain"
    });
}).then(function(wallet) {
  console.log("Root m/0/0/0 => "+wallet.getID());

    console.log('Main address: '+ wallet.getAddress('base58check'));
    

  // Add our address to the spv filter.
  pool.watchAddress(wallet.getAddress());

  wallet.getAccountPaths(0).then(function(result){
      var a;
      for (var i in result){
        a =result[i].toAddress();

        // console.log("Paths======>",a.toString());
      }
    });
    pool.watchAddress(wallet.getAddress('base58check'));
    

    // wallet.getBalance(0).then(function(result){
    //     console.log("Balance======>",result);
    // });
    console.log("Generating 20 nearest addresses");
    for (var i=0;i<20;i++){
      wallet.createKey(0).then(function (res){
        pool.watchAddress(res.getAddress('base58check'));  
        console.log("watching " + res.getAddress('base58check'));
      });
    }

  // Connect, start retrieving and relaying txs
  pool.connect().then(function() {
    // Start the blockchain sync.
    pool.startSync();

    pool.on('tx', function(tx) {
      walletdb.addTX(tx);
    });

    wallet.on('balance', function(balance) {
      console.log('Balance updated.');
      console.log(bcoin.amount.btc(balance.unconfirmed));
    });
  });
});