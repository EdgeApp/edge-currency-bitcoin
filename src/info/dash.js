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
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADjklEQVR4nO2WT2gdVRTGf+fe+97Ln5eUUqIUF1W0FBrpSowLF3kgVAwYUBIKLhQXrnTVpNjVZFxIFwHRnboQNy6eghUlabGQ7HQtpIiCVlwEqdKYNG/em5l7j4tJ8++9lKRJdGG+5XDvfOd8853zDRzhCP8x5IDO7BW624OHQQ5RZIjU7I5grG4PjPjsmDKIMC4eAFXpXMBY3fL5eGDi2nnK3R+QrnoQs/8KFIxVbPk3mknEey987+5/Wl+lVDlN3gRzQEKogiudwbWeYfLrp9oVUBVElGimn1V+xtjjeK/IA/pBVdrV05yuapk0idoVmJq3QE5iXqbvxEMky+AqD8QNQPCQN9lqN7GoKkp142kUGRg2LPYJJ1eURvMcpZ7HyBLPZq9oEIwEwpqRdoIEg4gnMIgzV8gzRdbeo6q4ipBlo4czZptxcfYy3dV3SZZzRBxKoFQ2ZK1brPhBRxQZ4lh5+9vTGDdK2vSICEENqEFE132hKOUeS9r4iaGVr7hxx/Dc8dBGujBwrzHHauN18pQNH2ig1GXIs2/4aKThYNhAnOP9ZaoDr8HSzo4PHnqOQbY6yfi4J5oTxmvtn6IYY8+la0/jKk+QtQLCPSMa8hREvygqjGs5F6/3ovl5lv9oEnJFOzheUMQIS8kqrvkJAFPDnrhDoWfXFAiMU65A1gogppC/YsiSX+k99R0gxRRYLtD/yEmSv8GYzptaPXQfg6XFGa689Bf1ukU6GlGIazlvzVRQP0rW3Cq/qxjy7CrxkynRnCsKEPMnzZV3yJJAwEEAti8+DWAtoleJ5hw3+oSxeofusdzE0+WexblHSZOArO8BS9YCY4uLN2/r4U3BxOyHdFXf2OZ+IUt/pNp9jrjmAS0UqKtlYV5oNB/Hlk+Rtjxme054wIKGAKbd+evIQUslNLxIllBcorhX6nLk+ZfEtZxozhHX8qKAhSkljj0Ts59S7h5Cwz6yp1wsvTwDn4OIoBpwJUtrtYHVj0EFpgKAEKkhlsDk7BkwP6DeoArskJS7gupGByFgS45SF7SSV5h+/rP1MQUczBsgoHKB3v4yjSWw9wvJPUAMlCqGPL1D6+6bTI9sIS8KmBr2EBkaOkSrsYji8fn+sl8BQbB2iTS9Dun7TI/c2k4O6xGlQjTfy93fFR7eFzcA1RPK7V8MA2MNYikM24H830FdbZG0nbHJaIexEwT28Ad8hP8n/gG2C4Umw5c7YAAAAABJRU5ErkJggg=='
}
