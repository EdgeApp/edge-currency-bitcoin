// @flow
import type { Plugin } from '../../types/types.js'
import { addNetwork } from '../commons/network.js'

export const addPlugin = (moduleName: Plugin) => {
  if (Array.isArray(moduleName)) {
    moduleName.forEach(addPlugin)
  } else {
    try {
      if (!moduleName.startsWith('@perian/')) {
        throw new Error('Unknown plugin name')
      }
      const plugin = moduleName.replace('@perian/', '').split('-')
      if (plugin[0] === 'network') {
        // $FlowFixMe
        addNetwork(plugin[1], require(moduleName))
      }
    } catch (e) {
      console.log(e)
    }
  }
}
