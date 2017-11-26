/**
 * Created by paul on 8/26/17.
 * @flow
 */

import { validate } from 'jsonschema'

function validateObject (object: any, schema: any) {
  let result = null
  try {
    result = validate(object, schema)
  } catch (e) {
    console.log(e)
    return false
  }

  if (result && result.errors && result.errors.length === 0) {
    return true
  } else {
    if (result.errors) {
      for (const n in result.errors) {
        const errMsg = result.errors[n].message
        console.log('ERROR: validateObject:' + errMsg)
      }
    }
    return false
  }
}

export { validateObject }
