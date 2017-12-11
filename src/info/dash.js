// @flow
import type { AbcCurrencyInfo } from 'airbitz-core-types'

export const dashInfo: AbcCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'DASH',
  currencyName: 'Dash',
  pluginName: 'dash',
  denominations: [{ name: 'DASH', multiplier: '100000000', symbol: 'D' }],
  walletTypes: ['wallet:dash-bip44'],

  // Configuration options:
  defaultSettings: {
    network: {
      type: 'dash',
      magic: 0xd9b4bef9,
      keyPrefix: {
        privkey: 0x80,
        xpubkey: 0x02fe52cc,
        xprivkey: 0x02fe52f8,
        xpubkey58: 'xpub',
        xprivkey58: 'xprv',
        coinType: 5
      },
      addressPrefix: {
        pubkeyhash: 0x4c,
        scripthash: 0x10,
        witnesspubkeyhash: null,
        witnessscripthash: null,
        bech32: null
      }
    },
    gapLimit: 10,
    maxFee: 100000,
    defaultFee: 10000,
    feeUpdateInterval: 60000,
    feeInfoServer: '',
    infoServer: '',
    simpleFeeSettings: {
      highFee: '300',
      lowFee: '100',
      standardFeeLow: '150',
      standardFeeHigh: '200',
      standardFeeLowAmount: '20000000',
      standardFeeHighAmount: '981000000'
    },
    electrumServers: [
      ['ele.coinpools.de', '50008'],
      ['electrum.dash.siampm.com', '50002']
    ]
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://explorer.dash.org/address/%s',
  blockExplorer: 'https://explorer.dash.org/block/%s',
  transactionExplorer: 'https://explorer.dash.org/tx/%s',

  // Images:
  symbolImage:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADjklEQVR4nO2WT2gdVRTGf+fe+97Ln5eUUqIUF1W0FBrpSowLF3kgVAwYUBIKLhQXrnTVpNjVZFxIFwHRnboQNy6eghUlabGQ7HQtpIiCVlwEqdKYNG/em5l7j4tJ8++9lKRJdGG+5XDvfOd8853zDRzhCP8x5IDO7BW624OHQQ5RZIjU7I5grG4PjPjsmDKIMC4eAFXpXMBY3fL5eGDi2nnK3R+QrnoQs/8KFIxVbPk3mknEey987+5/Wl+lVDlN3gRzQEKogiudwbWeYfLrp9oVUBVElGimn1V+xtjjeK/IA/pBVdrV05yuapk0idoVmJq3QE5iXqbvxEMky+AqD8QNQPCQN9lqN7GoKkp142kUGRg2LPYJJ1eURvMcpZ7HyBLPZq9oEIwEwpqRdoIEg4gnMIgzV8gzRdbeo6q4ipBlo4czZptxcfYy3dV3SZZzRBxKoFQ2ZK1brPhBRxQZ4lh5+9vTGDdK2vSICEENqEFE132hKOUeS9r4iaGVr7hxx/Dc8dBGujBwrzHHauN18pQNH2ig1GXIs2/4aKThYNhAnOP9ZaoDr8HSzo4PHnqOQbY6yfi4J5oTxmvtn6IYY8+la0/jKk+QtQLCPSMa8hREvygqjGs5F6/3ovl5lv9oEnJFOzheUMQIS8kqrvkJAFPDnrhDoWfXFAiMU65A1gogppC/YsiSX+k99R0gxRRYLtD/yEmSv8GYzptaPXQfg6XFGa689Bf1ukU6GlGIazlvzVRQP0rW3Cq/qxjy7CrxkynRnCsKEPMnzZV3yJJAwEEAti8+DWAtoleJ5hw3+oSxeofusdzE0+WexblHSZOArO8BS9YCY4uLN2/r4U3BxOyHdFXf2OZ+IUt/pNp9jrjmAS0UqKtlYV5oNB/Hlk+Rtjxme054wIKGAKbd+evIQUslNLxIllBcorhX6nLk+ZfEtZxozhHX8qKAhSkljj0Ts59S7h5Cwz6yp1wsvTwDn4OIoBpwJUtrtYHVj0EFpgKAEKkhlsDk7BkwP6DeoArskJS7gupGByFgS45SF7SSV5h+/rP1MQUczBsgoHKB3v4yjSWw9wvJPUAMlCqGPL1D6+6bTI9sIS8KmBr2EBkaOkSrsYji8fn+sl8BQbB2iTS9Dun7TI/c2k4O6xGlQjTfy93fFR7eFzcA1RPK7V8MA2MNYikM24H830FdbZG0nbHJaIexEwT28Ad8hP8n/gG2C4Umw5c7YAAAAABJRU5ErkJggg==',
  symbolImageDarkMono:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAABGdBTUEAAYagMeiWXwAAAAJiS0dEAP+Hj8y/AAACVklEQVRIx+1UQUtUYRQ9937fc2wmhISCNmmkzEIQimhatGojs8lFUEYLn2bRQO5qoRuhhbRwU0JDJDW1aCFBBpH0C8pNi1YSRFMt2pQGoj7f++53W0wzOZLOSMs6q8cH59x37rkc4D/+GtTEy3bQ5gS3xQiP8h8IedMMuUs76LoAC0SbqfM+7AvuJAJuLMHKn+KJx2/sFleDtlua9GGzcnLoeE1ggXJytS06vZGI0g4KStX/cy7VllyoCZQMXHw2cyBCy45zPaT6aVR1L1X2GfAy7dOo1x52olSZxF5lC5tJtMfcckoEqFpy/buIrYLBsdbJyJFVb9mV13vsCM/opW7uT4TIM5hUiVQ1MMn77PO3fMxXqV8IgF0fdgAD8AHLi9k1GzCcH0uHqMvOoxXuxrgUaLxmI2/mZfiE6XKeGAA70FPAFl2Y0b7VyKvW7JASrazyQyCUYk20kwB/LgXnweotu4/p1yAL8EDm4EZd9ooUVl4++D5pcr/XSEV3MaX9VQOWZe5uXLAWoG/xTee9rXNgaK5g31G+9nTIfJaWU6YzqRgwDjwLlHVXKYT3Uld+JUBuMd1bFKgFpswHio5wh5PNF6gefgs/0DMOMAB8YOVZ0RVs0VlgUWckfBTkGs0nCARE6o2J1/h+OyUesKM87YeyOBo5bdQGWlmfsRbx5VI5b2YEsI7hdWBPS4SmigCWZTm+VnqSN/MCADaUhCUXf1WRBi2gIOIf7pXeLpWrdICAdjqfWdXGHZLWJd6/Nu0rN7mb9OowZUbqZhEAtDd9DUvbdPG/jZ9EOv17Vyd1BAAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxNy0xMi0wOVQwMjo1NjowNyswMDowMAq6BSYAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTctMTItMDlUMDI6NTY6MDgrMDA6MDCNr81zAAAAAElFTkSuQmCC'
}
