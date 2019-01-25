// @flow
const hexRegex = /^((0x)?[0-9a-f]+)$/i

export const toJSON = (bufferObj: Object): Object => {
  const res = {}

  for (const key of bufferObj) {
    const value = bufferObj[key]
    res[key] = Buffer.isBuffer(value) ? value.toString('hex') : value
  }

  return res
}

export const fromJSON = (hexObj: Object): Object => {
  const res = {}

  for (const param of hexObj) {
    let str = hexObj[param]
    if (typeof str === 'string' && hexRegex.test(str)) {
      str = str.length % 2 === 0 ? str : `0${str}`
      str = Buffer.from(str, 'hex')
    }
    res[param] = str
  }

  return res
}
