import {
    ABCTxLibBTC
} from "./modules/abcTxLibBTC.js"

import {
    txLibInfo
} from "./txLibInfo.js"

//including Bcoin Engine
var bcoin = require("../vendor/bcoin.js")

function makeBitcoinPlugin(opts) {
    if (opts === void 0)
        opts = {}

    var io = opts.io

    return {
        getInfo: function() {
            var currencyDetails = txLibInfo.getInfo

            return currencyDetails
        },

        createMasterKeys: function(walletType) {
            if (walletType === 'bitcoin') {

                var master = new bcoin.masterkey()

                mnemonic = new bcoin.mnemonic(null)
                var key = bcoin.hd.fromMnemonic(mnemonic, null)

                master.fromKey(key, mnemonic)

                var hex = master.key.privateKey.toString("base64")
                var mnemonic = master.mnemonic.phrase

                return {
                    bitcoinKey: hex,
                    mnemonic: mnemonic
                }
            } else {
                return null
            }
        },

        makeEngine: function(keyInfo, opts) {
            // console.log("Key",keyInfo, "OPTS", opts);
            if (opts === void 0) opts = {}

            var abcTxLib = new ABCTxLibBTC(io, keyInfo, opts)

            return abcTxLib
        }
    }
}

export {
    makeBitcoinPlugin
}