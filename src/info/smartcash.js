// @flow

import { type EdgeCurrencyInfo } from "edge-core-js/types";

import { type EngineCurrencyInfo } from "../../types/engine.js";

const engineInfo: $Shape<EngineCurrencyInfo> = {
  maxFee: 1000000,
  defaultFee: 100000,

  simpleFeeSettings: {
    highFee: "1500",
    lowFee: "200",
    standardFeeLow: "500",
    standardFeeHigh: "1000",
    standardFeeLowAmount: "1732000",
    standardFeeHighAmount: "86700000"
  }
};

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: "SMART",
  displayName: "SmartCash",
  pluginName: "smartcash",
  denominations: [
    { name: "SMART", multiplier: "100000000", symbol: "S" },
    { name: "mSMART", multiplier: "100000", symbol: "mS" }
  ],
  // Configuration options:
  defaultSettings: {
    electrumServers: [
      "electrum://electrum1.smartcash.cc:50001",
      "electrum://electrum2.smartcash.cc:50001",
      "electrum://electrum3.smartcash.cc:50001",
      "electrum://electrum4.smartcash.cc:50001",
      "electrums://electrum1.smartcash.cc:50002",
      "electrums://electrum2.smartcash.cc:50002",
      "electrums://electrum3.smartcash.cc:50002",
      "electrums://electrum4.smartcash.cc:50002"
    ],
    disableFetchingServers: true
  },
  // Explorers:
  addressExplorer: "https://insight.smartcash.cc/address/%s",
  blockExplorer: "https://insight.smartcash.cc/block/%s",
  transactionExplorer: "https://insight.smartcash.cc/tx/%s"
};

export const smartcash = { engineInfo, currencyInfo };
