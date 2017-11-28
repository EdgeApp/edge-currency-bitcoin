/**
 * Created by paul on 8/26/17.
 * @flow
 */

import { validate } from 'jsonschema'

export function validateObject (object: any, schema: any) {
  let result = null
  try {
    result = validate(object, schema)
  } catch (e) {
    console.error(e)
    return false
  }

  return result && result.errors && result.errors.length === 0
}
