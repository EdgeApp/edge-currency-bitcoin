// @flow

import { type CurrencyPluginSettings } from '../../types/plugin.js'
import { addNetwork } from '../utils/bcoinExtender/bcoinExtender.js'
import { envSettings } from '../utils/utils.js'

const DEFAULT_CURRENCY_INFO = {
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    metaTokens: [],
    disableFetchingServers: false
  }
}

const DEFAULT_ENGINE_INFO = {
  gapLimit: 10,
  customFeeSettings: ['satPerByte'],
  feeInfoServer: '',
  feeUpdateInterval: 60000
}

export const mergeParams = (info: Object, defaults: Object) => {
  for (const key in defaults) {
    const defaultSetting = defaults[key]
    const currencySetting = info[key]
    if (Array.isArray(defaultSetting)) {
      info[key] = [...(currencySetting || []), ...defaultSetting]
    } else if (typeof defaultSetting === 'object') {
      info[key] = Object.assign({}, defaultSetting, currencySetting || {})
    } else {
      info[key] = currencySetting || defaultSetting
    }
  }
}

export const FixCurrencyCode = (currencyCode: string): string => {
  switch (currencyCode) {
    case 'BTC':
      return 'BC1'
    case 'DGB':
      return 'DGB1'
    default:
      return currencyCode
  }
}

export const setDefaultInfo = ({
  engineInfo,
  currencyInfo
}: CurrencyPluginSettings) => {
  // ////// Setup the Currency Info Object ////// //
  const {
    currencyCode,
    pluginName,
    symbolImage,
    symbolImageDarkMono,
    walletType,
    defaultSettings
  } = currencyInfo

  const { imageServer, infoServer } = envSettings
  // Set the currency image Url's
  const colorImage = symbolImage || `${pluginName}-logo-solo-64.png`
  const monoImage = symbolImageDarkMono || `${pluginName}-logo-solo-64.png`
  currencyInfo.symbolImage = `${imageServer}/${colorImage}`
  currencyInfo.symbolImageDarkMono = `${imageServer}/${monoImage}`

  // Set the walletType
  const fixedPluginName = pluginName.replace('testnet', '-testnet')
  currencyInfo.walletType = walletType || `wallet:${fixedPluginName}`

  // Set the Default Settings
  mergeParams(defaultSettings, DEFAULT_CURRENCY_INFO.defaultSettings)

  // ////// Setup the Engine Info Object ////// //
  if (!engineInfo.currencyCode) engineInfo.currencyCode = currencyCode
  if (!engineInfo.network) engineInfo.network = pluginName

  const { network } = engineInfo

  // Inject the new network info into bcoin
  addNetwork(network)

  // Set the info server Url's for the currency
  const fixedCode = FixCurrencyCode(currencyCode)
  engineInfo.electrumServersUrl = `${infoServer}/electrumServers/${fixedCode}`
  engineInfo.networkFeesUrl = `${infoServer}/networkFees/${currencyCode}`

  // Set the rest of the Default Engine Info
  mergeParams(engineInfo, DEFAULT_ENGINE_INFO)

  return { engineInfo, currencyInfo }
}
