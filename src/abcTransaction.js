export class ABCTransaction {
  constructor (txid, date, currencyCode, blockHeightNative, nativeAmount, nativeNetworkFee, signedTx, otherParams) {
    this.txid = txid
    this.date = date
    this.currencyCode = currencyCode
    this.blockHeightNative = blockHeightNative
    this.blockHeight = 0
    this.nativeAmount = nativeAmount
    this.amountSatoshi = nativeAmount
    this.nativeNetworkFee = nativeNetworkFee
    this.networkFee = nativeNetworkFee
    this.signedTx = signedTx
    this.otherParams = otherParams
  }
}
