// @flow

import type { FunctionFormatterOptions } from './types.js'
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
