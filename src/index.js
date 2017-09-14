import CurrencyPlugin from './currencyPlugin/index'
import bitcoinSettings from './bitcoinPlugin/index.js'
import litecoinSettings from './litecoinPlugin/index.js'
import dogecoinSettings from './dogeecoinPlugin/index.js'

export default {
  BitcoinCurrencyPluginFactory: CurrencyPlugin(bitcoinSettings),
  LitecoinCurrencyPluginFactory: CurrencyPlugin(litecoinSettings),
  DogecoinCurrencyPluginFactory: CurrencyPlugin(dogecoinSettings)
}
