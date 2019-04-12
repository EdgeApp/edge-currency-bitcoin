// @flow
// The native code will use this file to set up the IO object
// before sending it across the bridge to the core side.

import { pbkdf2, secp256k1 } from 'react-native-fast-crypto'
import { bridgifyObject } from 'yaob'

export default () =>
  bridgifyObject(pbkdf2) && bridgifyObject(secp256k1) && { pbkdf2, secp256k1 }
