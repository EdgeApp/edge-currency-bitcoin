// @flow

import { type HDPath } from '../../types/hd.js'
import { HARDENED, MAX_INDEX } from './common.js'
import { isNumeric } from '../utils/utils.js'

export const fromNumber = (index: number, harden: boolean = false): string => {
  if (index > MAX_INDEX) throw new Error(`Index out of range: ${index}`)
  // If it's a harden index, we need to set the flag and normalize the index
  if (index >= HARDENED) {
    harden = true
    index = index - HARDENED
  }
  return harden ? `${index}'` : `${index}`
}

export const toNumber = (index: string): number => {
  // Check for hardened flag
  const hardened = index[index.length - 1] === '\''
  // If hardened, we need to remove the harden flag
  if (hardened) index = index.slice(0, -1)
  // Index must be a number
  if (!isNumeric(index)) throw new Error(`Index must be a number: ${index}`)
  let indexNumber = parseInt(index)
  // If hardened, we need to add the HARDENED param to the index
  if (hardened) indexNumber += HARDENED

  if (indexNumber > MAX_INDEX) throw new Error(`Index out of range: ${indexNumber}`)
  return indexNumber
}

export const toString = (path: HDPath): string => {
  try {
    return 'm/' + path.map(a => fromNumber(a)).join('/')
  } catch (e) {
    e.message = `Bad path: ${JSON.stringify(path)}\n\t${e.message}`
    throw e
  }
}

export const fromString = (path: string, root: string = 'm'): HDPath => {
  try {
    const pathArr = path.split('/')
    const pathRoot = pathArr.shift()
    if (pathRoot !== root) throw new Error(`Unknown path root: '${pathRoot}', expected: '${root}'`)
    return pathArr.map(toNumber)
  } catch (e) {
    e.message = `Bad path: ${path}\n\t${e.message}`
    throw e
  }
}
