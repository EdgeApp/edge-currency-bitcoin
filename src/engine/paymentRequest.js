// @flow
// $FlowFixMe
import buffer from 'buffer-hack'
import { primitives, bip70 } from 'bcoin'
import parse from 'url-parse'
import type { EdgePaymentProtocolInfo } from 'edge-core-js'
import { toNewFormat, toLegacyFormat } from '../utils/addressFormat/addressFormatIndex.js'

const { Buffer } = buffer

type FetchOptions = {
  method: string,
  headers: any,
  body?: any
}

const fetchBuffer = async (
  fetch: any,
  url: string,
  method: string,
  headers: any,
  data: any
) => {
  // Legacy fetching using XMLHttpRequest
  // This is for enviroments that don't support 'arrayBuffer'
  // like some versions of react-native and old browsers
  const legacyBufferFetch = () =>
    new Promise((resolve, reject) => {
      const req = new window.XMLHttpRequest()
      req.open(method, url, true)
      for (const header in headers) {
        req.setRequestHeader(header, headers[header])
      }
      req.responseType = 'arraybuffer'
      req.onload = event => {
        const resp = req.response
        if (resp) {
          resolve(resp)
        }
      }
      req.onerror = err => reject(err)
      req.send(data)
    })

  let result = Buffer.alloc(0)
  const opts: FetchOptions = { method, headers }
  if (data) Object.assign(opts, { body: data })
  // Use the modern API if in node or any enviroment which supports it
  if (
    typeof window === 'undefined' ||
    (window.Response && window.Response.prototype.arrayBuffer)
  ) {
    result = await fetch(url, opts)
    result = await result.arrayBuffer()
  } else if (window && window.XMLHttpRequest) {
    result = await legacyBufferFetch()
  }
  return Buffer.from(result)
}

const getSpendTargets = (outputs: Array<any>, network: string, currencyCode: string) => {
  let nativeAmount = 0
  const spendTargets = []
  for (const output of outputs) {
    const jsonObj = output.getJSON(network)
    nativeAmount += jsonObj.value
    spendTargets.push({
      currencyCode: currencyCode,
      publicAddress: toNewFormat(jsonObj.address, network),
      nativeAmount: `${jsonObj.value}`
    })
  }
  return { nativeAmount, spendTargets }
}

const getBitPayPayment = async (
  paymentProtocolURL: string,
  network: string,
  fetch: any
): Promise<EdgePaymentProtocolInfo> => {
  const headers = { Accept: 'application/payment-request' }
  const result = await fetch(paymentProtocolURL, { headers })
  if (parseInt(result.status) !== 200) {
    const error = await result.text()
    throw new Error(error)
  }
  const paymentRequest = await result.json()
  const { outputs, memo, paymentUrl, paymentId, requiredFeeRate, currency } = paymentRequest
  const parsedOutputs = outputs.map(({ amount, address }) => {
    const legacyAddress = toLegacyFormat(address, network)
    return primitives.Output.fromOptions({ value: amount, address: legacyAddress })
  })
  const { nativeAmount, spendTargets } = getSpendTargets(parsedOutputs, network, currency)
  const domain = parse(paymentUrl, {}).hostname
  // $FlowFixMe
  const edgePaymentProtocolInfo: EdgePaymentProtocolInfo = {
    nativeAmount: `${nativeAmount}`,
    merchant: { paymentId, requiredFeeRate },
    memo,
    domain,
    spendTargets,
    paymentUrl
  }

  return edgePaymentProtocolInfo
}

export const parsePayment = (
  paymentBuffer: Buffer,
  network: string,
  currencyCode: string
): EdgePaymentProtocolInfo => {
  const paymentRequest = bip70.PaymentRequest.fromRaw(paymentBuffer)
  const { paymentDetails } = paymentRequest
  const { paymentUrl = '', memo = '', outputs = [] } = paymentDetails
  const merchantData =
    paymentDetails.getData('json') || paymentDetails.merchantData
  const domain = parse(paymentUrl, {}).hostname
  const { nativeAmount, spendTargets } = getSpendTargets(outputs, network, currencyCode)

  const edgePaymentProtocolInfo: EdgePaymentProtocolInfo = {
    nativeAmount: `${nativeAmount}`,
    merchant: merchantData || '',
    memo,
    domain,
    spendTargets,
    paymentUrl
  }

  return edgePaymentProtocolInfo
}

export async function getPaymentDetails (
  paymentProtocolURL: string,
  network: string,
  currencyCode: string,
  fetch: any
): Promise<EdgePaymentProtocolInfo> {
  const domain = parse(paymentProtocolURL, {}).hostname
  if (domain === 'bitpay.com') return getBitPayPayment(paymentProtocolURL, network, fetch)
  const headers = { Accept: `application/${network}-paymentrequest` }
  const buf = await fetchBuffer(fetch, paymentProtocolURL, 'GET', headers, null)
  return parsePayment(buf, network, currencyCode)
}

export function createPayment (
  paymentDetails: EdgePaymentProtocolInfo,
  refundAddress: string,
  tx: string
): any {
  if (paymentDetails.domain === 'bitpay.com') {
    return { currency: paymentDetails.currency, transactions: [tx] }
  } else {
    const refundOutput = primitives.Output.fromOptions({ value: paymentDetails.nativeAmount, address: refundAddress })
    const txObj = primitives.TX.fromRaw(tx, 'hex')
    return bip70.Payment.fromOptions({
      transactions: [txObj],
      refundTo: [refundOutput],
      memo: paymentDetails.memo,
      merchantData: paymentDetails.merchant
    }).toRaw()
  }
}

export async function sendPayment (
  fetch: any,
  network: string,
  paymentUrl: string,
  payment: any
): Promise<any> {
  const domain = parse(paymentUrl, {}).hostname
  if (domain === 'bitpay.com') {
    const headers = { 'Content-Type': 'application/payment' }
    const result = await fetch(paymentUrl, { method: 'POST', headers, body: JSON.stringify(payment) })
    if (parseInt(result.status) !== 200) {
      const error = await result.text()
      throw new Error(error)
    }
    const paymentACK = await result.json()
    return paymentACK
  } else {
    const headers = {
      'Content-Type': `application/${network}-payment`,
      Accept: `application/${network}-paymentack`
    }
    const buf = await fetchBuffer(fetch, paymentUrl, 'POST', headers, payment)
    const paymentACK = bip70.PaymentACK.fromRaw(buf)
    return paymentACK
  }
}
