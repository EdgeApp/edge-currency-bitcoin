// @flow
export type HashFunction = (payload: string) => string | Promise<string>
export type Alphabet = [string, string] | string
export type Base = {
  encode: (hexStr: string) => Promise<string>,
  decode: (baseStr: string) => Promise<string>
}
export type BaseCheck = Base & { check: Base }
export type Bases = { [baseName: string]: BaseCheck }
