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