import txLibInfo from './currencyInfo'
import bcoin from 'lcoin'
import CurrencyPlugin from './../currencyPlugin/index'

export const LitecoinCurrencyPluginFactory = CurrencyPlugin({
  magicBytes: {
    testnet: 0xB0,
    main: 0x30
  },
  txLibInfo,
  bcoin
})
