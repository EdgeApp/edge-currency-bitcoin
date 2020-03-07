// @flow

import { type EdgeCurrencyInfo } from "edge-core-js/types";

import { type EngineCurrencyInfo } from "../../types/engine.js";

const engineInfo: $Shape<EngineCurrencyInfo> = {
  maxFee: 1000000,
  defaultFee: 1000,
  simpleFeeSettings: {
    highFee: "150",
    lowFee: "20",
    standardFeeLow: "50",
    standardFeeHigh: "100",
    standardFeeLowAmount: "173200",
    standardFeeHighAmount: "8670000"
  }
};

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: "DGB",
  displayName: "DigiByte",
  pluginName: "digibyte",
  denominations: [
    { name: "DGB", multiplier: "100000000", symbol: "Ɗ" },
    { name: "mDGB", multiplier: "100000", symbol: "mƊ" }
  ],
  // Configuration options:
  defaultSettings: {
    electrumServers: [
      "electrum://electrum-alts-wusa2-az.edge.app:50021",
      "electrum://electrum-alts-weuro-az.edge.app:50021",
      "electrum://electrum-alts-ejapan-az.edge.app:50021"
    ]
  },
  // Explorers:
  blockExplorer: "https://digiexplorer.info/block/%s",
  addressExplorer: "https://digiexplorer.info/address/%s",
  transactionExplorer: "https://digiexplorer.info/tx/%s"
};

export const digibyte = { engineInfo, currencyInfo };
