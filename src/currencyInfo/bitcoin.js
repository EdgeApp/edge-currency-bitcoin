/* global */

export const bitcoin = {
  supportedTokens: [],

  getInfo: {
    // Details of supported currency
    walletTypes: [
      'wallet:bitcoin44',
      'wallet:bitcoin',
      'wallet:testnet44',
      'wallet:testnet'
    ],
    defaultsSettings: {
      gapLimit: 25,
      maxFee: 1000000,
      feeUpdateInterval: 10000,
      feeInfoServer: 'https://bitcoinfees.21.co/api/v1/fees/list',
      simpleFeeSettings: {low: 6, standard: 2, high: 0},
      electrumServers: [
        ['h.1209k.com', '50001'],
        ['electrum-bu-az-weuro.airbitz.co', '50001'],
        ['electrum-bc-az-eusa.airbitz.co', '50001'],
        ['electrum-bu-az-ausw.airbitz.co', '50001'],
        ['electrum.hsmiths.com', '8080'],
        ['e.anonyhost.org', '50001'],
        ['electrum.no-ip.org', '50001'],
        ['electrum-bu-az-wusa2.airbitz.co', '50001'],
        ['electrum-bu-az-wjapan.airbitz.co', '50001'],
        ['kerzane.ddns.net', '50001']
      ],
      diskPath: {
        folder: 'txEngineFolderBTC',
        files: {
          walletLocalData: 'walletLocalDataV4.json',
          transactions: 'transactionsV1.json',
          headerList: 'headersV1.json',
          transactionsIds: 'transactionsIdsV1.json',
          wallet: 'walletDBv1.json',
          memoryDump: 'dummyMemoryDumpV1.json'
        }
      }
    },
    blockExplorer: 'https://insight.bitpay.com/block/%s',
    addressExplorer: 'https://insight.bitpay.com/address/%s',
    transactionExplorer: 'https://insight.bitpay.com/tx/%s',
    currencyName: 'Bitcoin',
    denomCurrencyCode: 'Bits',
    currencyCode: 'BTC', // The 3 character code for the currency
    denominations: [
      // An array of Objects of the possible denominations for this currency
      {
        name: 'BTC',
        multiplier: '100000000',
        symbol: 'B'
      },
      {
        name: 'mBTC',
        multiplier: '100000',
        symbol: 'mB'
      },
      {
        name: 'bits', // The human readable string to describe the denomination
        multiplier: '100', // The value to multiply the smallest unit of currency to get to the denomination
        symbol: 'μBTC' // The human readable 1-3 character symbol of the currency, e.g “Ƀ”
      }
    ],
    symbolImage: 'data:image/png;base64,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', // Base64 encoded png or jpg image of the currency symbol (optional)
    metaTokens: []
  }
}
