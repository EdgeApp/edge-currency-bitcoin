// @flow
import { makeFakeIos } from 'edge-login'
import { describe, it, before } from 'mocha'
import * as Factories from '../../src/index.js'
import { assert } from 'chai'
import { toLegacyFormat } from '../../src/utils/addressFormat/addressFormatIndex.js'

const fixtures = [
  {
    factory: 'bitcoinCurrencyPluginFactory',
    WALLET_TYPE: 'wallet:bitcoin',
    valid: [
      [ '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu', '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu' ],
      [ '1KXrWXciRDZUpQwQmuM1DbwsKDLYAYsVLR', '1KXrWXciRDZUpQwQmuM1DbwsKDLYAYsVLR' ],
      [ '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb', '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb' ],
      [ '3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC', '3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC' ],
      [ '3LDsS579y7sruadqu11beEJoTjdFiFCdX4', '3LDsS579y7sruadqu11beEJoTjdFiFCdX4' ],
      [ '31nwvkZwyPdgzjBJZXfDmSWsC4ZLKpYyUw', '31nwvkZwyPdgzjBJZXfDmSWsC4ZLKpYyUw' ],
      [ '18uKBY8mgA7MWfRHpw8faQRZQtssqXWSJS', '18uKBY8mgA7MWfRHpw8faQRZQtssqXWSJS' ],
      [ '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN', '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN' ],
      [ 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' ],
      [ 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3' ],
      [ 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' ],
      [ 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9', 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' ]
    ],
    inValid: [
      'XekiLaxnqpFb2m4NQAEcsKutZcZgcyfo6W',
      'XiBQaGtW6y1C52YtPBD4PTMntpA9hkBq5p',
      'XqWgAZEGdWDUhbS1YxSwxrK3GLGdJjSHus',
      'XbtvGzi2JgjYTbTqabUjSREWeovDxznoyh',
      'Xx9R3uriMAF2W71WH5kwpNdoHxqzGGih3c',
      'Xm9TJiJ7nWjme8K7iEPUGsC5JjYGzPk2QU',
      'XvwKzdsn46psqy6WhZ2wfhRPyRkD6GL2BG',
      'LQL9pVH1LsMfKwt82Y2wGhNGkrjF8vwUst',
      'LPpHectVSbk7YHa5X89Cm3FoFBfzkJBJc9',
      'LRcYfbDMhwvXaGPFccaKuc3fZD1Nb55aGn',
      'LY5fxZS74Ewuj1TTHwat23eUmZwimsksrU',
      'LdP8Qox1VAhCzLJNqrr74YovaWYyNBUWvL',
      'Laub752qu81oWwkNKEyawyKruUC6cEyD2x',
      'LbHBMZTQBq7aM5WS5TeKYJWH8pxeaLoRXe',
      'LPpVeFSKvH593CChqP9qpV5toEXntekjiF',
      'LfmG6qepmucU2aQaVJK4EJgBzQHeGz5ML4',
      'MSS1jxX7vEjHi5ujzszwTsZCnSDhkWKrBd',
      'M816EdyuvWV7oETCfQeZb5mGWm9nHczijH',
      'MJiPwX84iBe4WnFDwsYGgtnz1XonPhUqhf',
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
      'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy',
      'bitcoincash:qqq3728yw0y47sqn6l2na30mcw6zm78dzqre909m2r',
      'bitcoincash:ppm2qsznhks23z7629mms6s4cwef74vcwvn0h829pq',
      'bitcoincash:pr95sy3j9xwd2ap32xkykttr4cvcu7as4yc93ky28e',
      'bitcoincash:pqq3728yw0y47sqn6l2na30mcw6zm78dzq5ucqzc37',
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a'
    ]
  },
  {
    factory: 'bitcoincashCurrencyPluginFactory',
    WALLET_TYPE: 'wallet:bitcoincash',
    valid: [
      [ 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a', '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu' ],
      [ 'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy', '1KXrWXciRDZUpQwQmuM1DbwsKDLYAYsVLR' ],
      [ 'bitcoincash:qqq3728yw0y47sqn6l2na30mcw6zm78dzqre909m2r', '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb' ],
      [ 'bitcoincash:ppm2qsznhks23z7629mms6s4cwef74vcwvn0h829pq', '3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC' ],
      [ 'bitcoincash:pr95sy3j9xwd2ap32xkykttr4cvcu7as4yc93ky28e', '3LDsS579y7sruadqu11beEJoTjdFiFCdX4' ],
      [ 'bitcoincash:pqq3728yw0y47sqn6l2na30mcw6zm78dzq5ucqzc37', '31nwvkZwyPdgzjBJZXfDmSWsC4ZLKpYyUw' ],
      [ 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a', '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu' ]
    ],
    inValid: [
      '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu',
      '1KXrWXciRDZUpQwQmuM1DbwsKDLYAYsVLR',
      '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
      '3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC',
      '3LDsS579y7sruadqu11beEJoTjdFiFCdX4',
      '31nwvkZwyPdgzjBJZXfDmSWsC4ZLKpYyUw',
      '18uKBY8mgA7MWfRHpw8faQRZQtssqXWSJS',
      '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN',
      'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9',
      'XekiLaxnqpFb2m4NQAEcsKutZcZgcyfo6W',
      'XiBQaGtW6y1C52YtPBD4PTMntpA9hkBq5p',
      'XqWgAZEGdWDUhbS1YxSwxrK3GLGdJjSHus',
      'XbtvGzi2JgjYTbTqabUjSREWeovDxznoyh',
      'Xx9R3uriMAF2W71WH5kwpNdoHxqzGGih3c',
      'Xm9TJiJ7nWjme8K7iEPUGsC5JjYGzPk2QU',
      'XvwKzdsn46psqy6WhZ2wfhRPyRkD6GL2BG',
      'LQL9pVH1LsMfKwt82Y2wGhNGkrjF8vwUst',
      'LPpHectVSbk7YHa5X89Cm3FoFBfzkJBJc9',
      'LRcYfbDMhwvXaGPFccaKuc3fZD1Nb55aGn',
      'LY5fxZS74Ewuj1TTHwat23eUmZwimsksrU',
      'LdP8Qox1VAhCzLJNqrr74YovaWYyNBUWvL',
      'Laub752qu81oWwkNKEyawyKruUC6cEyD2x',
      'LbHBMZTQBq7aM5WS5TeKYJWH8pxeaLoRXe',
      'LPpVeFSKvH593CChqP9qpV5toEXntekjiF',
      'LfmG6qepmucU2aQaVJK4EJgBzQHeGz5ML4',
      'MSS1jxX7vEjHi5ujzszwTsZCnSDhkWKrBd',
      'M816EdyuvWV7oETCfQeZb5mGWm9nHczijH',
      'MJiPwX84iBe4WnFDwsYGgtnz1XonPhUqhf'
    ]
  },
  {
    factory: 'litecoinCurrencyPluginFactory',
    WALLET_TYPE: 'wallet:litecoin',
    valid: [
      ['LQL9pVH1LsMfKwt82Y2wGhNGkrjF8vwUst', 'LQL9pVH1LsMfKwt82Y2wGhNGkrjF8vwUst'],
      ['LPpHectVSbk7YHa5X89Cm3FoFBfzkJBJc9', 'LPpHectVSbk7YHa5X89Cm3FoFBfzkJBJc9'],
      ['LRcYfbDMhwvXaGPFccaKuc3fZD1Nb55aGn', 'LRcYfbDMhwvXaGPFccaKuc3fZD1Nb55aGn'],
      ['LY5fxZS74Ewuj1TTHwat23eUmZwimsksrU', 'LY5fxZS74Ewuj1TTHwat23eUmZwimsksrU'],
      ['LdP8Qox1VAhCzLJNqrr74YovaWYyNBUWvL', 'LdP8Qox1VAhCzLJNqrr74YovaWYyNBUWvL'],
      ['Laub752qu81oWwkNKEyawyKruUC6cEyD2x', 'Laub752qu81oWwkNKEyawyKruUC6cEyD2x'],
      ['LbHBMZTQBq7aM5WS5TeKYJWH8pxeaLoRXe', 'LbHBMZTQBq7aM5WS5TeKYJWH8pxeaLoRXe'],
      ['LPpVeFSKvH593CChqP9qpV5toEXntekjiF', 'LPpVeFSKvH593CChqP9qpV5toEXntekjiF'],
      ['LfmG6qepmucU2aQaVJK4EJgBzQHeGz5ML4', 'LfmG6qepmucU2aQaVJK4EJgBzQHeGz5ML4'],
      ['MSS1jxX7vEjHi5ujzszwTsZCnSDhkWKrBd', '3LDsS579y7sruadqu11beEJoTjdFiFCdX4'],
      ['M816EdyuvWV7oETCfQeZb5mGWm9nHczijH', '31nwvkZwyPdgzjBJZXfDmSWsC4ZLKpYyUw'],
      ['MJiPwX84iBe4WnFDwsYGgtnz1XonPhUqhf', '3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC']
    ],
    inValid: [
      '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu',
      '1KXrWXciRDZUpQwQmuM1DbwsKDLYAYsVLR',
      '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
      '3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC',
      '3LDsS579y7sruadqu11beEJoTjdFiFCdX4',
      '31nwvkZwyPdgzjBJZXfDmSWsC4ZLKpYyUw',
      '18uKBY8mgA7MWfRHpw8faQRZQtssqXWSJS',
      '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN',
      'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9',
      'XekiLaxnqpFb2m4NQAEcsKutZcZgcyfo6W',
      'XiBQaGtW6y1C52YtPBD4PTMntpA9hkBq5p',
      'XqWgAZEGdWDUhbS1YxSwxrK3GLGdJjSHus',
      'XbtvGzi2JgjYTbTqabUjSREWeovDxznoyh',
      'Xx9R3uriMAF2W71WH5kwpNdoHxqzGGih3c',
      'Xm9TJiJ7nWjme8K7iEPUGsC5JjYGzPk2QU',
      'XvwKzdsn46psqy6WhZ2wfhRPyRkD6GL2BG',
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
      'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy',
      'bitcoincash:qqq3728yw0y47sqn6l2na30mcw6zm78dzqre909m2r',
      'bitcoincash:ppm2qsznhks23z7629mms6s4cwef74vcwvn0h829pq',
      'bitcoincash:pr95sy3j9xwd2ap32xkykttr4cvcu7as4yc93ky28e',
      'bitcoincash:pqq3728yw0y47sqn6l2na30mcw6zm78dzq5ucqzc37',
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a'
    ]
  },
  {
    factory: 'dashCurrencyPluginFactory',
    WALLET_TYPE: 'wallet:dash',
    valid: [
      [ 'XekiLaxnqpFb2m4NQAEcsKutZcZgcyfo6W', 'XekiLaxnqpFb2m4NQAEcsKutZcZgcyfo6W' ],
      [ 'XiBQaGtW6y1C52YtPBD4PTMntpA9hkBq5p', 'XiBQaGtW6y1C52YtPBD4PTMntpA9hkBq5p' ],
      [ 'XqWgAZEGdWDUhbS1YxSwxrK3GLGdJjSHus', 'XqWgAZEGdWDUhbS1YxSwxrK3GLGdJjSHus' ],
      [ 'XbtvGzi2JgjYTbTqabUjSREWeovDxznoyh', 'XbtvGzi2JgjYTbTqabUjSREWeovDxznoyh' ],
      [ 'Xx9R3uriMAF2W71WH5kwpNdoHxqzGGih3c', 'Xx9R3uriMAF2W71WH5kwpNdoHxqzGGih3c' ],
      [ 'Xm9TJiJ7nWjme8K7iEPUGsC5JjYGzPk2QU', 'Xm9TJiJ7nWjme8K7iEPUGsC5JjYGzPk2QU' ],
      [ 'XvwKzdsn46psqy6WhZ2wfhRPyRkD6GL2BG', 'XvwKzdsn46psqy6WhZ2wfhRPyRkD6GL2BG' ]
    ],
    inValid: [
      'LQL9pVH1LsMfKwt82Y2wGhNGkrjF8vwUst',
      'LPpHectVSbk7YHa5X89Cm3FoFBfzkJBJc9',
      'LRcYfbDMhwvXaGPFccaKuc3fZD1Nb55aGn',
      'LY5fxZS74Ewuj1TTHwat23eUmZwimsksrU',
      'LdP8Qox1VAhCzLJNqrr74YovaWYyNBUWvL',
      'Laub752qu81oWwkNKEyawyKruUC6cEyD2x',
      'LbHBMZTQBq7aM5WS5TeKYJWH8pxeaLoRXe',
      'LPpVeFSKvH593CChqP9qpV5toEXntekjiF',
      'LfmG6qepmucU2aQaVJK4EJgBzQHeGz5ML4',
      'MSS1jxX7vEjHi5ujzszwTsZCnSDhkWKrBd',
      'M816EdyuvWV7oETCfQeZb5mGWm9nHczijH',
      'MJiPwX84iBe4WnFDwsYGgtnz1XonPhUqhf',
      '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu',
      '1KXrWXciRDZUpQwQmuM1DbwsKDLYAYsVLR',
      '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
      '3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC',
      '3LDsS579y7sruadqu11beEJoTjdFiFCdX4',
      '31nwvkZwyPdgzjBJZXfDmSWsC4ZLKpYyUw',
      '18uKBY8mgA7MWfRHpw8faQRZQtssqXWSJS',
      '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN',
      'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9',
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
      'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy',
      'bitcoincash:qqq3728yw0y47sqn6l2na30mcw6zm78dzqre909m2r',
      'bitcoincash:ppm2qsznhks23z7629mms6s4cwef74vcwvn0h829pq',
      'bitcoincash:pr95sy3j9xwd2ap32xkykttr4cvcu7as4yc93ky28e',
      'bitcoincash:pqq3728yw0y47sqn6l2na30mcw6zm78dzq5ucqzc37',
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a'
    ]
  }
]

for (const fixture of fixtures) {
  const CurrencyPluginFactory = Factories[fixture['factory']]
  const WALLET_TYPE = fixture['WALLET_TYPE']

  const [fakeIo] = makeFakeIos(1)
  const opts = {
    io: Object.assign(fakeIo, {
      random: size => {},
      Socket: require('net').Socket,
      TLSSocket: require('tls').TLSSocket
    })
  }

  describe(`Info for Wallet type ${WALLET_TYPE}`, function () {
    let plugin

    before('Plugin', function (done) {
      CurrencyPluginFactory.makePlugin(opts).then(currencyPlugin => {
        plugin = currencyPlugin
        done()
      })
    })

    it('test valid addresses', function () {
      for (const address of fixture['valid']) {
        plugin.encodeUri({ publicAddress: address[0] })
      }
    })

    it('test invalid addresses', function () {
      for (const address of fixture['inValid']) {
        assert.throws(() => {
          plugin.encodeUri({ publicAddress: address })
        }, 'InvalidPublicAddressError')
      }
    })
    it('get legacy format', function () {
      for (const address of fixture['valid']) {
        assert(toLegacyFormat(address[0], fixture['WALLET_TYPE'].split('wallet:')[1]) === address[1])
      }
    })
  })
}
