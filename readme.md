# Airbitz Bitcoin Currency Plugin

Implements Bitcoin send/receive functionality per the spec for currency plugins for [airbitz-core-js](https://github.com/Airbitz/airbitz-core-js)

## Installing

Since this package is not on NPM, you will have to use the current git version

npm i git+ssh://git@github.com/Airbitz/airbitz-currency-bitcoin.git -s

```
import { BitcoinCurrencyPluginFactory } from `airbitz-currency-bitcoin`
```

Now you can pass `BitcoinCurrencyPluginFactory` to `airbitz-core-js`.

```
const context = makeReactNativeContext({
  apiKey: YOUR_API_KEY,
  plugins: [ BitcoinCurrencyPluginFactory ]
})
```

This plugin exposes the following `otherSettings` which can be set using abcAccount.updateSettings()

```
{
  enableOverrideServers: boolean
  overrideServers: Array<string>
}
```
`enableOverrideServers` = `true` will force the plugin to ONLY use the electrum servers specified in `overrideServers`. 
`overrideServers` should be in the format `electrum:[DNS name]:[port]`. ie `electrum:myserver.mydomain.com:50001`
