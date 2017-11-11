/**
 * Created by paul on 8/26/17.
 * @flow
 */

import { validate } from 'jsonschema'

function validateObject (object: any, schema: any) {
  const result = validate(object, schema)

  if (result.errors.length === 0) {
    return true
  } else {
    for (const n in result.errors) {
      const errMsg = result.errors[n].message
      console.log('ERROR: validateObject:' + errMsg)
    }
    return false
  }
}

export { validateObject }
