// @flow

import { type FunctionFormatterOptions } from '../../types/utils.js'
import { fromUint8Array, toUint8Array } from './uintArray.js'

export const formatFunction = (
  func: Function,
  opts?: FunctionFormatterOptions = {}
) => {
  const { numParams = 1, encoder, results = [], sync } = opts
  const { input = toUint8Array, output = fromUint8Array } = encoder || {}

  const encode = (i: number, cps = a => a) => {
    if (!i--) return cps
    const newCps = (p: any) => {
      p[i] = input(p[i])
      return cps(p)
    }
    return encode(i, newCps)
  }

  const paramEncoder = encode(numParams)

  let encodeResult = (res: any) => output(res)
  if (!results) {
    encodeResult = (res: any) => res
  } else if (results.length) {
    encodeResult = (res: any) => {
      for (const param of results) {
        res[param] = output(res[param])
      }
      return res
    }
  }

  let waitResult = async (res: any) => {
    res = await res
    return encodeResult(res)
  }
  if (sync) waitResult = (res: any) => encodeResult(res)

  return (...params: any): any => {
    const result = func(...paramEncoder(params))
    return waitResult(result)
  }
}

export const formatByteSize = (
  originalByteSize: number,
  newByteSize: number,
  pad: boolean = originalByteSize > newByteSize
) => (data: Array<number>) => {
  let acc = 0
  let bits = 0
  const ret = []
  const maxNum = (1 << newByteSize) - 1
  for (let p = 0; p < data.length; ++p) {
    const value = data[p]
    if (value < 0 || value >> originalByteSize !== 0) {
      throw new Error('Wrong bit value')
    }
    acc = (acc << originalByteSize) | value
    bits += originalByteSize
    while (bits >= newByteSize) {
      bits -= newByteSize
      ret.push((acc >> bits) & maxNum)
    }
  }
  if (pad && bits > 0) {
    ret.push((acc << (newByteSize - bits)) & maxNum)
  } else if (
    bits >= originalByteSize ||
    (acc << (newByteSize - bits)) & maxNum
  ) {
    throw new Error('Wrong bit value')
  }
  return ret
}
