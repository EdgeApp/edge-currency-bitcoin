// @flow
import { expect } from 'chai'
import { describe, it, afterEach } from 'mocha'
import {
  makeFakeContexts,
  makeFakeIos,
  destroyAllContexts
} from 'airbitz-core-js'
import type { AbcAccount } from 'airbitz-core-types'

import {
  BitcoinPluginFactory,
  BitcoincashPluginFactory,
  DogecoinPluginFactory,
  LitecoinPluginFactory
} from '../src/index.js'

const plugins = [
  BitcoinPluginFactory,
  BitcoincashPluginFactory,
  DogecoinPluginFactory,
  LitecoinPluginFactory
]

async function makeFakeAccount (plugins): Promise<AbcAccount> {
  const [context] = makeFakeContexts({ plugins })
  return context.createAccount('fake user', void 0, '1111', {})
}

afterEach(function () {
  destroyAllContexts()
})

for (const pluginFactory of plugins) {
  const { pluginName } = pluginFactory

  describe(`${pluginName} plugin`, function () {
    it('can be created manually', async function () {
      const [io] = makeFakeIos(1)
      expect(pluginFactory.pluginType).to.equal('currency')
      const currencyPlugin = await pluginFactory.makePlugin({ io })
      expect(currencyPlugin.currencyInfo.pluginName).to.equal(pluginName)
    })

    it('can be created by the core', async function () {
      const account = await makeFakeAccount([pluginFactory])
      account.logout()
    })
  })
}
