# Airbitz Bitcoin Currency Plugin

Implements Bitcoin send/receive functionality per the spec for currency plugins for [airbitz-core-js](https://github.com/Airbitz/airbitz-core-js)

## Installing

Since this package is not on NPM, you will have to use the current git version

npm i git+ssh://git@github.com/Airbitz/airbitz-currency-ethereum.git -s

```js
import { BitcoinCurrencyPluginFactory } from `airbitz-currency-bitcoin`
```

Now you can pass `BitcoinCurrencyPluginFactory` to `airbitz-core-js`.

```js
const context = makeReactNativeContext({
  apiKey: YOUR_API_KEY,
  plugins: [ BitcoinCurrencyPluginFactory ]
})
```

This plugin exposes the following `otherSettings` which can be set using abcAccount.updateSettings()

```js
{
  enableOverrideServers: boolean,
  electrumServers: Array<Array[String, String]>,
  feeInfoServer: String
}
```

`enableOverrideServers` = `true` will force the plugin to ONLY use the electrum servers specified in `electrumServers`.
`electrumServers` should be in the format [`[DNS name]`, `[port]`]. ie [`h.1209k.com`, `50001`]
`feeInfoServer` should be the fee server, should have the same API as `https://bitcoinfees.21.co/api/v1/fees/list`
