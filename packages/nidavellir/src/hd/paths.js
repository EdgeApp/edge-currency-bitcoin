import { base } from '../utils/base.js'
const bech32 = base['58'].check

export const bip32 = {
  purpose: 32,
  scriptType: 'P2PKH',
  xpriv: {
    prefix: 0x0488ade4,
    decoder: base['58'].check
  },
  xpub: {
    prefix: 0x0488b21e,
    decoder: base['58'].check
  },
  address: {
    prefix: 0x80,
    decoder: base['58'].check
  }
}

export const bip44 = {
  purpose: 44,
  scriptType: 'P2PKH',
  xpriv: {
    prefix: 0x0488ade4,
    decoder: base['58'].check
  },
  xpub: {
    prefix: 0x0488b21e,
    decoder: base['58'].check
  },
  address: {
    prefix: 0x80,
    decoder: base['58'].check
  }
}

export const bip49 = {
  purpose: 49,
  scriptType: 'P2WPKH-P2SH',
  xpriv: {
    prefix: 0x0488ade4,
    decoder: base['58'].check
  },
  xpub: {
    prefix: 0x0488b21e,
    decoder: base['58'].check
  },
  address: {
    prefix: 0x05,
    decoder: base['58'].check
  }
}

export const bip84 = {
  purpose: 84,
  scriptType: 'P2WPKH',
  xpriv: {
    prefix: 0x04b2430c,
    decoder: base['58'].check
  },
  xpub: {
    prefix: 0x04b24746,
    decoder: base['58'].check
  },
  address: {
    prefix: 'bc',
    decoder: bech32
  }
}
