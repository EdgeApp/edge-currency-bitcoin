// @flow

export const imageServerUrl = 'https://content.edge.app'
export const InfoServer = 'https://info1.edge.app/v1'

export const FixCurrencyCode = (currencyCode: string): string => {
  switch (currencyCode) {
    case 'BTC':
      return 'BC1'
    case 'DGB':
      return 'DGB1'
    case 'FIRO':
      return 'XZC'
    default:
      return currencyCode
  }
}
