// @flow

import CurrencyPlugin from './currencyPlugin/indexPlugin'
import * as plugins from './currencyInfo/indexInfo'

const pluginFactories = {}

for (const plugin in plugins) {
  const factoryName = `${plugin.charAt(0).toUpperCase() + plugin.slice(1)}CurrencyPluginFactory`
  pluginFactories[factoryName] = CurrencyPlugin(plugins[plugin])
}

export { pluginFactories as default }
