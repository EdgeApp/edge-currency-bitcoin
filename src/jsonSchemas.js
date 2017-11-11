/**
 * Created by Paul Puey 2017/11/09.
 * @flow
 */

export const EarnComFeesSchema = {
  'type': 'object',
  'properties': {
    'fees': {
      'type': 'array',
      'items': {
        'type': 'object',
        'properties': {
          'minFee': {'type': 'number'},
          'maxFee': {'type': 'number'},
          'dayCount': {'type': 'number'},
          'memCount': {'type': 'number'},
          'minDelay': {'type': 'number'},
          'maxDelay': {'type': 'number'},
          'minMinutes': {'type': 'number'},
          'maxMinutes': {'type': 'number'}
        },
        'required': ['minFee', 'maxFee', 'dayCount', 'memCount', 'minDelay', 'maxDelay', 'minMinutes', 'maxMinutes']
      }
    },
    'required': ['fees']
  }
}
