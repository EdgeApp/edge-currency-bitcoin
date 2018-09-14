// @flow
// $FlowFixMe
import buffer from 'buffer-hack'
import { primitives, bip70 } from 'bcoin'
import parse from 'url-parse'
import type { EdgePaymentProtocolInfo } from 'edge-core-js'
import { toNewFormat } from '../utils/addressFormat/addressFormatIndex.js'

const { Buffer } = buffer

type Payment = {
  transactions: Array<string>,
  refundTo: Array<{ address: string, value: number }>,
  merchantData: any,
  memo?: string
}

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

export const parsePayment = (
  paymentBuffer: Buffer,
  network: string,
  currencyCode: string
): EdgePaymentProtocolInfo => {
  const paymentRequest = bip70.PaymentRequest.fromRaw(paymentBuffer)
  const { paymentDetails } = paymentRequest
  const { paymentUrl = '', memo = '', outputs = [] } = paymentDetails
  const merchantData = paymentDetails.getData('json') || paymentDetails.merchantData
  const domain = parse(paymentUrl, {}).hostname
  const spendTargets = []
  let nativeAmount = 0

  for (const output of outputs) {
    const jsonObj = output.getJSON(network)
    nativeAmount += jsonObj.value
    spendTargets.push({
      currencyCode: currencyCode,
      publicAddress: toNewFormat(jsonObj.address, network),
      nativeAmount: `${jsonObj.value}`
    })
  }

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
  const headers = { Accept: `application/${network}-paymentrequest` }
  const buf = await fetchBuffer(fetch, paymentProtocolURL, 'GET', headers, null)
  return parsePayment(buf, network, currencyCode)
}

export async function createPayment ({
  transactions,
  refundTo,
  memo,
  merchantData
}: Payment): Promise<Buffer> {
  const paymentBuffer = bip70.Payment.fromOptions({
    transactions: transactions.map(tx => primitives.TX.fromRaw(tx, 'hex')),
    refundTo: refundTo.map(refund => primitives.Output.fromOptions(refund)),
    memo,
    merchantData
  }).toRaw()

  return paymentBuffer
}

export async function sendPayment (
  fetch: any,
  network: string,
  paymentUrl: string,
  payment: Buffer
): Promise<any> {
  const headers = {
    'Content-Type': `application/${network}-payment`,
    Accept: `application/${network}-paymentack`
  }
  const buf = await fetchBuffer(fetch, paymentUrl, 'POST', headers, payment)
  const paymentACK = bip70.PaymentACK.fromRaw(buf)
  console.log('paymentACK', paymentACK)
  return paymentACK
}
