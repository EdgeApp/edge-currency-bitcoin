// @flow

import { type EdgeIo } from 'edge-core-js/types'

import { logger } from '../utils/logger.js'

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
        logger.info('SUCCESS makeBroadcastBlockchainInfo')
        return true
      } else {
        logger.info('ERROR makeBroadcastBlockchainInfo', response)
        throw new Error(`blockchain.info failed with status ${response.status}`)
      }
    } catch (e) {
      logger.info('ERROR makeBroadcastBlockchainInfo', e)
      throw e
    }
  }
}

const makeBroadcastInsight = (io: EdgeIo, currencyCode: string) => {
  const supportedCodes = ['BCH']
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
          logger.info('SUCCESS makeBroadcastInsight:' + JSON.stringify(out))
          return out
        }
      }
      logger.info('ERROR makeBroadcastInsight', response)
      throw new Error(
        `${urls[currencyCode]} failed with status ${response.status}`
      )
    } catch (e) {
      logger.info('ERROR makeBroadcastInsight:', e)
      throw e
    }
  }
}

const makeBroadcastBlockcypher = (io: EdgeIo, currencyCode: string) => {
  const supportedCodes = ['BTC', 'LTC', 'DASH']
  if (!supportedCodes.find(c => c === currencyCode)) {
    return null
  }
  currencyCode = currencyCode.toLowerCase()
  return async (rawTx: string) => {
    try {
      const body = { tx: rawTx }
      const response = await io.fetch(
        `https://api.blockcypher.com/v1/${currencyCode}/main/txs/push`,
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
      logger.info('SUCCESS makeBroadcastBlockcypher: ', out)
      return out.hash
    } catch (e) {
      logger.info('ERROR makeBroadcastBlockcypher: ', e)
      throw e
    }
  }
}

const broadcastFactories = [
  makeBroadcastBlockchainInfo,
  makeBroadcastInsight,
  makeBroadcastBlockcypher
]

export { broadcastFactories }
