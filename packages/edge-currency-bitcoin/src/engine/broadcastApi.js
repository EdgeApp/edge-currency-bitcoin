// @flow

import { type EdgeIo } from 'edge-core-js/types'

import { allInfo } from '../info/all.js'

const makeBroadcastBlockchainInfo = (io: EdgeIo, currencyCode: string) => {
  const supportedCodes = ['BTC']
  if (!supportedCodes.find(c => c === currencyCode)) {
    return null
  }
  return async (rawTx: string) => {
    try {
      const response = await io.fetch('https://blockchain.info/pushtx', {
        method: 'POST',
        body: 'tx=' + rawTx,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      if (response.ok) {
        io.console.info('SUCCESS makeBroadcastBlockchainInfo')
        return true
      } else {
        io.console.info('ERROR makeBroadcastBlockchainInfo', response)
        throw new Error(`blockchain.info failed with status ${response.status}`)
      }
    } catch (e) {
      io.console.info('ERROR makeBroadcastBlockchainInfo', e)
      throw e
    }
  }
}

const makeBroadcastInsight = (io: EdgeIo, currencyCode: string) => {
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
      const response = await io.fetch(urls[currencyCode], {
        method: 'POST',
        body: 'rawtx=' + rawTx,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      if (response.ok) {
        const out = await response.json()
        if (out.txid) {
          io.console.info('SUCCESS makeBroadcastInsight:' + JSON.stringify(out))
          return out
        }
      }
      io.console.info('ERROR makeBroadcastInsight', response)
      throw new Error(
        `${urls[currencyCode]} failed with status ${response.status}`
      )
    } catch (e) {
      io.console.info('ERROR makeBroadcastInsight:', e)
      throw e
    }
  }
}

const makeBroadcastBlockchair = (io: EdgeIo, currencyCode: string) => {
  const supportedCodes = ['DOGE', 'BTC', 'BCH', 'LTC', 'BSV', 'DASH', 'GRS'] // does seem to appear for GRS?
  if (!supportedCodes.find(c => c === currencyCode)) {
    return null
  }
  currencyCode = currencyCode.toLowerCase()
  const info = allInfo.find(currency => {
    return currency.currencyInfo.currencyCode === currencyCode.toUpperCase()
  })
  let pluginName
  if (info && info.currencyInfo) {
    pluginName = info.currencyInfo.pluginName
    if (pluginName === 'bitcoinsv') pluginName = 'bitcoin-sv' // special case (hyphen)
    if (pluginName === 'bitcoincash') pluginName = 'bitcoin-cash' // special case (hyphen)
  } else {
    return null
  }

  return async (rawTx: string) => {
    try {
      const body = { data: rawTx }
      const response = await io.fetch(
        `https://api.blockchair.com/${pluginName}/push/transaction`,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          method: 'POST',
          body: JSON.stringify(body)
        }
      )
      const out = await response.json()
      io.console.info('SUCCESS makeBroadcastBlockcypher: ', out)
      if (out.context && out.context.error) {
        io.console.info('makeBroadcastBlockchair fail with out: ', out)
        throw new Error(
          `https://api.blockchair.com/${pluginName}/push/transaction failed with error ${
            out.context.error
          }`
        )
      }
      io.console.info(
        'makeBroadcastBlockchair executed successfully with hash: ',
        out.data.transaction_hash
      )
      return out.data.transaction_hash
    } catch (e) {
      io.console.info('ERROR makeBroadcastBlockchair: ', e)
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
