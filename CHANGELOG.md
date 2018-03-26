# edge-currency-bitcoin

## 2.14.12-pending

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
