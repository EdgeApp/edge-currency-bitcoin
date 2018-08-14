# edge-currency-bitcoin

## 3.2.7

* Fix a param on digibyte
* Fix issues with sweeping private keys on networks without segwit

## 3.2.6

* fix a bug in the throttling of updateFee

## 3.2.5

* fixed minor bitcoin gold issues
* disable support for bip70 for bitcoincash for now

## 3.2.4

* Made all currency query the infoServer for electrum servers and fee info.

## 3.2.3

* Allow get headers electrum call to return nonce of number or string

## 3.2.2

* changed dogecoin icon to an URI
* updated edge-core-js

## 3.2.1

* reordered the walletTypes before we will completly remove them

## 3.2.0

* Add Vertcoin
* Add Dodgecoin
* Add Digibyte

## 3.1.1

* Add missing default wallet type to QTUM

## 3.1.0

* Pass in optional params to createPrivateKeys
* Add legacy address to UFO coin
* Generelize the legacy and cashAddress mechanisms

## 3.0.1

* allow `forks` to be optional inside bcoinInfo

## 3.0.0

### BREAKING CHANGES

* Stop supporting receiving the wallet format as type of the wallet type.
  For example, `wallet:bitcoin-bip44` is not supported anymore.
  The CORRECT way to pass in the wallet format is inside the keys object which is in the walletInfo.
  Example:

  ```js
  walletInfo = {
    keys: {
      seed: 'whatever whatever whatever whatever whatever whatever whatever',
      format: 'bip49'
    }
  }
  ```

* Split each currency Info into 3 different config objects depends on the where and how they are going to be used:
  1. bcoinInfo - The data needed to extend Bcoin into supporting the currency
  2. engineInfo - The hard coded data needed to configure the engine for the currency
  3. currencyInfo - The original EdgeCurrencyInfo needed to be passed on to core/gui according to the API specs - This got ALOT cleaner

  Also typed everything so no more using `defaultSettings` which was typed as Any as a garbage hole where we stuffed everything we didn't know where to put.
  Everything is now strongly typed so keep it like that.

### New Features

* `getSplittableTypes` API to the plugin.
* bip84 wallet type as default to the networks that supports it.
* Settings and factories for `BitcoinGold` and `BitcoinGoldTestnet`.

### Fix

* Two Way Replay Protection scheme.
* `sweepPrivateKey` only signed with a key corresponding to the wallet type. Now we try all possible combinations.

## 2.22.0

* Full support for the SIGHASH_FORKID two-way replay protection scheme (For forks like bcash and bgold)
* Full support for bip84 wallets.
* Removed all of the $FlowFixMe (except for the one for 'buffer-hack') from the code.
* Refactored the code so that almost all (around 90%) of the references to bcoin and its' implementation details are hidden inside a utility function (in the utils folder) and not spread all over the code base.

## 2.21.9

* Use a different network specific header for fetching paymentRequests

## 2.21.8

* Changed currency name for ufo from 'UFO Coin' to 'UFO'

## 2.21.7

* Fix headers for bip70 payment request

## 2.21.6

* update the lock file to get the new bcoin with bip70

## 2.21.3

* Re-enable support for Bip70

## 2.21.2

* Fix sweepPrivKey for the following coins: Dash, Litecoin, Feathercoin, Zcoin

## 2.21.1

* Update icons and explorers

## 2.21.0

* Add support for Bip70

## 2.20.1

* Re-order bitcoin wallet types to put segwit up top

## 2.18.0

* Add private key sweeping.

## 2.17.1

* Add broadcast APIs for BTC, BCH, LTC, and DASH
* Improve serverCache usage by depleting all servers returned for getServers before asking for new servers

## 2.17.0

* Add support for FTC and XZC
* Fix crash when no info server is specified for a coin

## 2.16.3

* Set the response time if serverScoreDown() is called. This prevents this server from being considered "new" and being tried again in the future at the top of the list.
* Fix port numbers for zcoin electrum servers
* Fix zcoin block explorer urls
* Completely ignore electrums: urls for now

## 2.16.2

* Catch errors from stratum servers

## 2.16.1

* Fix unhandled exception due to LTC transactions with bech32 outputs

## 2.16.0

* Allow for Parse Uri to recognize legacy address

## 2.15.0

* Add Zcoin support
* Fix throw in getTransaction when tx has an OP_RETURN

## 2.14.11

* Filter uncofimred UTXO's the pendingTxids list for servers that return uncofimred UTXO's as part of the tx history.
* Better caching mechanism
* Use the "onAddressesChecked" callback to return a value between 0 and 1 for how "synced" the engine is.
* Styling fixes
* Flow fixes
* Tests fixes

## 2.14.10

* Return Transaction date in seconds and not miliseconds

## 2.14.9

* Fix .flowconfig to include all src files
* Fix flow errors from possibly undeclared vars
* Upgrade edge-core-js to 0.6.3 which includes Flow def for EdgeEncodeUri.legacyAddress

## 2.14.8

* Fix Flow errors

## 2.14.7

* Use edge-core-js instead of edge-login
