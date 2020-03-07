// @flow

import { type EdgeCurrencyInfo } from "edge-core-js/types";

import { type EngineCurrencyInfo } from "../../types/engine.js";

const engineInfo: $Shape<EngineCurrencyInfo> = {
  network: "uniformfiscalobject",
  maxFee: 1000000,
  defaultFee: 50000,

  simpleFeeSettings: {
    highFee: "2250",
    lowFee: "1000",
    standardFeeLow: "1100",
    standardFeeHigh: "2000",
    standardFeeLowAmount: "51282051282051",
    standardFeeHighAmount: "5128205128205100"
  }
};

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: "UFO",
  displayName: "UFO",
  pluginName: "ufo",
  denominations: [
    { name: "UFO", multiplier: "100000000", symbol: "Ʉ" },
    { name: "kUFO", multiplier: "100000000000", symbol: "kɄ" }
  ],
  // Configuration options:
  defaultSettings: {
    electrumServers: [
      "electrum://electrumx1.ufobject.com:50001",
      "electrum://electrumx2.ufobject.com:50001",
      "electrum://electrumx3.ufobject.com:50001",
      "electrum://electrumx4.ufobject.com:50001",
      "electrum://electrumx5.ufobject.com:50001"
    ]
  },
  // Explorers:
  addressExplorer: "https://explorer.ufobject.com/address/%s",
  blockExplorer: "https://explorer.ufobject.com/block/%s",
  transactionExplorer: "https://explorer.ufobject.com/tx/%s"
};

export const ufo = { engineInfo, currencyInfo };
