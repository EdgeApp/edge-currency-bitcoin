// @flow
export type HashFunction = (payload: Buffer) => Buffer | Promise<Buffer>
export type Alphabet = [string, string] | string
export type Base = {
  encode: (buff: Buffer) => Promise<string>,
  decode: (str: string) => Promise<Buffer>
}
export type BaseCheck = Base & { check: Base }
export type Bases = { [baseName: string]: BaseCheck }
