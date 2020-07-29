// @flow

import type { Disklet } from 'disklet'

import { CurrencyEngine } from '../../engine/currencyEngine'
import { CurrencyEngineExtension } from '../../engine/currencyEngineExtension'
import { EngineState } from '../../engine/engineState'
import { EngineStateExtension } from '../../engine/engineStateExtension'
import { KeyManager } from '../../engine/keyManager'
import type { PluginIo } from '../../plugin/pluginIo'
import { logger } from '../../utils/logger'
import { ZcoinStateExtension } from './zcoinStateExtension'

export class ZcoinEngineExtension implements CurrencyEngineExtension {
  currencyEngine: CurrencyEngine
  engineState: EngineState
  walletLocalEncryptedDisklet: Disklet
  keyManager: KeyManager
  io: PluginIo

  engineStateExtensions: EngineStateExtension
  zcoinStateExtensions: ZcoinStateExtension

  canRunLoop: boolean
  looperMethods: any

  constructor() {
    this.zcoinStateExtensions = new ZcoinStateExtension()
    this.engineStateExtensions = this.zcoinStateExtensions
  }

  async load(currencyEngine: CurrencyEngine) {
    this.currencyEngine = currencyEngine
    this.engineState = this.currencyEngine.engineState
    this.walletLocalEncryptedDisklet = this.currencyEngine.walletLocalEncryptedDisklet
    this.keyManager = this.currencyEngine.keyManager
    this.io = this.currencyEngine.io

    this.runLooperIfNeed()
  }

  async loop() {}

  runLooperIfNeed() {
    this.canRunLoop = true
    this.addLooperMethodToLoop('loop', 60000)
  }

  cancelAllLooperMethods() {
    this.canRunLoop = false
    for (const looper in this.looperMethods) {
      clearTimeout(this.looperMethods[looper])
    }
  }

  async addLooperMethodToLoop(looperMethod: string, timer: number) {
    try {
      // $FlowFixMe
      await this[looperMethod]()
    } catch (e) {
      logger.error('addLooperMethodToLoop', looperMethod, e)
    }
    if (this.canRunLoop) {
      this.looperMethods[looperMethod] = setTimeout(() => {
        if (this.canRunLoop) {
          this.addLooperMethodToLoop('loop', timer)
        }
      }, timer)
    }
    return true
  }
}
