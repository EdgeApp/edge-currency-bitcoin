// @flow

import {
  type CurrencyEngineSettings,
  CurrencyEngine
} from '../../engine/currencyEngine.js'

interface CurrencyEngineFactory {
  make(settings: CurrencyEngineSettings): CurrencyEngine;
}

export const allCurrencyEngine: {
  [pluginName: string]: CurrencyEngineFactory
} = {}
