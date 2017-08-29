export class ABCTransaction {
  constructor ({ rawTx, wallet, currencyCode, metadata, txid, date, blockHeight, nativeAmount, providerFee, networkFee, runningBalance, signedTx, ourReceiveAddresses, otherParams }) {
    this.wallet = wallet
    this.rawTx = rawTx
    this.currencyCode = currencyCode
    this.metadata = metadata
    this.txid = txid
    this.date = date
    this.blockHeight = blockHeight
    this.nativeAmount = nativeAmount
    this.providerFee = providerFee
    this.networkFee = networkFee
    this.runningBalance = runningBalance
    this.signedTx = signedTx
    this.ourReceiveAddresses = ourReceiveAddresses
    this.otherParams = otherParams
  }
}
