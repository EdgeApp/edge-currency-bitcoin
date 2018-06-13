# edge-currency-bitcoin

## 2.18.1

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
