// @flow

import { type EdgeLog } from 'edge-core-js'

import { allInfo } from '../info/all.js'
import { type PluginIo } from '../plugin/pluginIo.js'

const makeBroadcastBlockchainInfo = (
  io: PluginIo,
  currencyCode: string,
  log: EdgeLog
) => {
  const supportedCodes = ['BTC']
  if (!supportedCodes.find(c => c === currencyCode)) {
    return null
  }
  return async (rawTx: string) => {
    try {
      const { fetchCors = io.fetch } = io
      const uri = 'https://blockchain.info/pushtx'
      const response = await fetchCors(uri, {
        method: 'POST',
        body: 'tx=' + rawTx,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      if (!response.ok) {
        throw new Error(`Error ${response.status} while fetching ${uri}`)
      }
      const responseText = await response.text()
      if (responseText === 'Transaction Submitted') {
        log('SUCCESS makeBroadcastBlockchainInfo has response', response)
        return true
      } else {
        log('ERROR makeBroadcastBlockchainInfo', responseText)
        throw new Error(`blockchain.info failed with status ${responseText}`)
      }
    } catch (e) {
      log('ERROR makeBroadcastBlockchainInfo', e)
      throw e
    }
  }
}

const makeBroadcastInsight = (
  io: PluginIo,
  currencyCode: string,
  log: EdgeLog
) => {
  const supportedCodes = []
  if (!supportedCodes.find(c => c === currencyCode)) {
    return null
  }

  const urls = {
    BCH: 'https://bch-insight.bitpay.com/api/tx/send',
    BTC: 'https://insight.bitpay.com/api/tx/send'
  }

  return async (rawTx: string) => {
    try {
      const uri = urls[currencyCode]
      const response = await io.fetch(uri, {
        method: 'POST',
        body: 'rawtx=' + rawTx,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      if (!response.ok) {
        throw new Error(`Error ${response.status} while fetching ${uri}`)
      }
      const out = await response.json()
      if (out.txid) {
        log('SUCCESS makeBroadcastInsight:' + JSON.stringify(out))
        return out
      }
    } catch (e) {
      log('ERROR makeBroadcastInsight:', e)
      throw e
    }
  }
}

const makeBroadcastBlockchair = (
  io: PluginIo,
  currencyCode: string,
  log: EdgeLog
) => {
  const supportedCodes = ['DOGE', 'BTC', 'BCH', 'LTC', 'BSV', 'DASH', 'GRS'] // does seem to appear for GRS?
  if (!supportedCodes.find(c => c === currencyCode)) {
    return null
  }
  currencyCode = currencyCode.toLowerCase()
  const info = allInfo.find(currency => {
    return currency.currencyInfo.currencyCode === currencyCode.toUpperCase()
  })
  let pluginId
  if (info && info.currencyInfo) {
    pluginId = info.currencyInfo.pluginId
    if (pluginId === 'bitcoinsv') pluginId = 'bitcoin-sv' // special case (hyphen)
    if (pluginId === 'bitcoincash') pluginId = 'bitcoin-cash' // special case (hyphen)
  } else {
    return null
  }

  return async (rawTx: string) => {
    try {
      const body = { data: rawTx }
      const { fetchCors = io.fetch } = io
      const uri = `https://api.blockchair.com/${pluginId}/push/transaction`
      const response = await fetchCors(uri, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify(body)
      })
      if (!response.ok) {
        throw new Error(`Error ${response.status} while fetching ${uri}`)
      }
      const out = await response.json()
      log(
        'makeBroadcastBlockchair fetch with body: ',
        body,
        ', response: ',
        response,
        ', out: ',
        out
      )
      if (out.context && out.context.error) {
        log('makeBroadcastBlockchair fail with out: ', out)
        throw new Error(
          `https://api.blockchair.com/${pluginId}/push/transaction failed with error ${out.context.error}`
        )
      }
      log(
        'makeBroadcastBlockchair executed successfully with hash: ',
        out.data.transaction_hash
      )
      return out.data.transaction_hash
    } catch (e) {
      log('ERROR makeBroadcastBlockchair: ', e)
      throw e
    }
  }
}

const broadcastFactories = [
  makeBroadcastBlockchainInfo,
  makeBroadcastInsight,
  makeBroadcastBlockchair
]

export { broadcastFactories }
