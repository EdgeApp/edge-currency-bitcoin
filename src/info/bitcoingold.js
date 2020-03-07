// @flow

import { type EdgeCurrencyInfo } from "edge-core-js/types";

import { type EngineCurrencyInfo } from "../../types/engine.js";

const engineInfo: $Shape<EngineCurrencyInfo> = {
  maxFee: 1000000,
  defaultFee: 1000,
  simpleFeeSettings: {
    highFee: "200",
    lowFee: "10",
    standardFeeLow: "15",
    standardFeeHigh: "140",
    standardFeeLowAmount: "17320",
    standardFeeHighAmount: "86700000"
  }
};

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: "BTG",
  displayName: "Bitcoin Gold",
  pluginName: "bitcoingold",
  denominations: [
    { name: "BTG", multiplier: "100000000", symbol: "₿" },
    { name: "mBTG", multiplier: "100000", symbol: "m₿" },
    { name: "bits", multiplier: "100", symbol: "ƀ" }
  ],
  // Configuration options:
  defaultSettings: {
    electrumServers: [
      "electrum://electrumx-eu.bitcoingold.org:50001",
      "electrums://electrumx-eu.bitcoingold.org:50002",
      "electrum://electrumx-us.bitcoingold.org:50001",
      "electrums://electrumx-us.bitcoingold.org:50002",
      "electrum://electrumx-eu.btcgpu.org:50001",
      "electrums://electrumx-eu.btcgpu.org:50002",
      "electrum://electrumx-us.btcgpu.org:50001",
      "electrums://electrumx-us.btcgpu.org:50002"
    ]
  },
  // Explorers:
  blockExplorer: "https://explorer.bitcoingold.org/insight/block/%s",
  addressExplorer: "https://explorer.bitcoingold.org/insight/address/%s",
  transactionExplorer: "https://explorer.bitcoingold.org/insight/tx/%s"
};

export const bitcoingold = { engineInfo, currencyInfo };
