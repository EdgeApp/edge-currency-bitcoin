// @flow
import { destroyAllContexts, makeFakeContexts, makeFakeIos } from 'edge-login'
import type {
  AbcAccount,
  AbcCurrencyPlugin,
  AbcCurrencyPluginCallbacks,
  AbcTransaction
} from 'edge-login'
import { expect } from 'chai'
import { makeMemoryFolder } from 'disklet'
import { afterEach, describe, it } from 'mocha'

import {
  bitcoinCurrencyPluginFactory,
  bitcoincashCurrencyPluginFactory,
  dogecoinCurrencyPluginFactory,
  litecoinCurrencyPluginFactory
} from '../src/index.js'

const plugins = [
  bitcoinCurrencyPluginFactory,
  bitcoincashCurrencyPluginFactory,
  dogecoinCurrencyPluginFactory,
  litecoinCurrencyPluginFactory
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
      const currencyPlugin: AbcCurrencyPlugin = await pluginFactory.makePlugin({
        io
      })
      expect(currencyPlugin.currencyInfo.pluginName).to.equal(pluginName)
    })

    it('can be created by the core', async function () {
      const account = await makeFakeAccount([pluginFactory])
      account.logout()
    })
  })
}

describe('bitcoin plugin', function () {
  it('can connect to a server', async function () {
    const pluginFactory = bitcoinCurrencyPluginFactory
    const [io] = makeFakeIos(1)
    io.Socket = require('net').Socket
    io.TLSSocket = require('tls').TLSSocket

    const currencyPlugin: AbcCurrencyPlugin = await pluginFactory.makePlugin({
      io
    })

    const keys = currencyPlugin.createPrivateKey(
      currencyPlugin.currencyInfo.walletTypes[0]
    )

    let done: () => void
    const promise = new Promise(resolve => {
      done = resolve
    })

    const callbacks: AbcCurrencyPluginCallbacks = {
      onBlockHeightChanged (blockHeight: number) {
        done()
      },
      onTransactionsChanged (abcTransactions: Array<AbcTransaction>) {},
      onBalanceChanged (currencyCode: string, nativeBalance: string) {},
      onAddressesChecked (progressRatio: number) {},
      onTxidsChanged (txids: Array<string>) {}
    }

    const engine = await currencyPlugin.makeEngine(
      { id: '', keys, type: 'wallet:bitcoin' },
      {
        callbacks,
        walletLocalFolder: makeMemoryFolder(),
        walletLocalEncryptedFolder: makeMemoryFolder()
      }
    )

    engine.startEngine()
    await promise
    engine.killEngine()
  })
})
