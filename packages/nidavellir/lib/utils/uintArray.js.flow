// @flow

export const isHexString = (hex: string) =>
  typeof hex === 'string' && /^[0-9a-f]*$/i.test(hex)

export const toUint8Array = (hexString: string): Uint8Array => {
  if (!isHexString(hexString)) {
    throw new Error(`${hexString} is Not a Hex string`)
  }
  if (hexString.length % 2 !== 0) hexString = `0${hexString}`
  const hex = hexString.match(/.{1,2}/g) || []
  const bytes = hex.map(byte => parseInt(byte, 16))
  return new Uint8Array(bytes)
}

export const fromUint8Array = (bytes: Uint8Array): string =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
