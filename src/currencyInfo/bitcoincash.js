/* global */

export const bitcoincash = {
  supportedTokens: [],

  getInfo: {
    // Details of supported currency
    walletTypes: [
      'wallet:bitcoincash-bip44',
      'wallet:bitcoincash'
    ],
    defaultsSettings: {
      gapLimit: 25,
      maxFee: 1000000,
      feeUpdateInterval: 10000,
      feeInfoServer: 'https://bitcoinfees.21.co/api/v1/fees/list',
      simpleFeeSettings: {low: 6, standard: 2, high: 0},
      electrumServers: [
        ['ogog.1209k.com', '50002'],
        ['h.1209k.com', '50002'],
        ['bch.kokx.org', '50002'],
        ['electron.coinucopia.io', '50002'],
        ['electrum-abc.criptolayer.net', '50012'],
        ['abc1.hsmiths.com', '60002'],
        ['electron.ueo.ch', '50002'],
        ['bch.curalle.ovh', '50002'],
        ['elecash.bcc.nummi.it', '50012'],
        ['electrumx-bch.adminsehow.com', '50012'],
        ['abc.vom-stausee.de', '52002'],
        ['bcc.arihanc.com', '52002'],
        ['mash.1209k.com', '50002'],
        ['crypto.mldlabs.com', '50002'],
        ['electrum-abc.petrkr.net', '50012']
      ],
      diskPath: {
        folder: 'txEngineFolderBCH',
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
    blockExplorer: 'https://blockchair.com/bitcoin-cash/block/%s',
    addressExplorer: 'https://blockchair.com/bitcoin-cash/address/%s',
    transactionExplorer: 'https://blockchair.com/bitcoin-cash/transaction/%s',
    currencyName: 'Bitcoin Cash',
    currencyCode: 'BCH', // The 3 character code for the currency
    denominations: [
      // An array of Objects of the possible denominations for this currency
      {
        name: 'BCH',
        multiplier: '100000000',
        symbol: '₿'
      },
      {
        name: 'mBCH',
        multiplier: '100000',
        symbol: 'm₿'
      },
      {
        name: 'bits', // The human readable string to describe the denomination
        multiplier: '100', // The value to multiply the smallest unit of currency to get to the denomination
        symbol: 'ƀ' // The human readable 1-3 character symbol of the currency, e.g “”
      }
    ],
    symbolImage: 'data:image/png;base64,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', // Base64 encoded png image of the currency symbol (optional)
    metaTokens: []
  }
}
