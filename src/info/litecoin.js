// @flow

import { type EdgeCurrencyInfo } from "edge-core-js/types";

import { type EngineCurrencyInfo } from "../../types/engine.js";

const engineInfo: $Shape<EngineCurrencyInfo> = {
  maxFee: 1000000,
  defaultFee: 50000,

  simpleFeeSettings: {
    highFee: "300",
    lowFee: "100",
    standardFeeLow: "150",
    standardFeeHigh: "200",
    standardFeeLowAmount: "20000000",
    standardFeeHighAmount: "981000000"
  }
};

const currencyInfo: $Shape<EdgeCurrencyInfo> = {
  // Basic currency information:
  currencyCode: "LTC",
  displayName: "Litecoin",
  pluginName: "litecoin",
  denominations: [
    { name: "LTC", multiplier: "100000000", symbol: "Ł" },
    { name: "mLTC", multiplier: "100000", symbol: "mŁ" }
  ],
  // Configuration options:
  defaultSettings: {
    electrumServers: [
      "electrum://electrum-ltc.festivaldelhumor.org:60001",
      "electrum://electrum-ltc.petrkr.net:60001",
      "electrum://electrumx.nmdps.net:9433",
      "electrums://electrum-ltc.festivaldelhumor.org:60002",
      "electrums://electrum-ltc.petrkr.net:60002",
      "electrums://electrum-ltc.villocq.com:60002",
      "electrum://electrum-ltc.villocq.com:60001",
      "electrums://elec.luggs.co:444",
      "electrums://ltc01.knas.systems:50004",
      "electrum://ltc01.knas.systems:50003",
      "electrums://electrum-ltc.wilv.in:50002",
      "electrum://electrum-ltc.wilv.in:50001",
      "electrums://electrum.ltc.xurious.com:50002",
      "electrum://electrum.ltc.xurious.com:50001",
      "electrums://lith.strangled.net:50003",
      "electrums://electrum.leblancnet.us:50004",
      "electrum://electrum.leblancnet.us:50003",
      "electrums://electrum-ltc0.snel.it:50004",
      "electrum://electrum-ltc0.snel.it:50003",
      "electrums://e-2.claudioboxx.com:50004",
      "electrum://e-2.claudioboxx.com:50003",
      "electrums://e-1.claudioboxx.com:50004",
      "electrum://e-1.claudioboxx.com:50003",
      "electrum://node.ispol.sk:50003",
      "electrums://electrum-ltc.bysh.me:50002",
      "electrum://electrum-ltc.bysh.me:50001",
      "electrums://e-3.claudioboxx.com:50004",
      "electrum://e-3.claudioboxx.com:50003",
      "electrums://node.ispol.sk:50004",
      "electrums://electrumx.nmdps.net:9434"
    ]
  },
  // Explorers:
  blockExplorer: "https://blockchair.com/litecoin/block/%s",
  addressExplorer: "https://blockchair.com/litecoin/address/%s",
  transactionExplorer: "https://blockchair.com/litecoin/transaction/%s"
};

export const litecoin = { engineInfo, currencyInfo };
