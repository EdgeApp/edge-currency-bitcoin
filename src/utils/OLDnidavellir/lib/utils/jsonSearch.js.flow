// @flow

import {
  type QueryParams,
  type RecQueryParams
} from '../../types/utils'

const searchRec = (query: RecQueryParams, jsonObj: any, parent: any): Array<any> => {
  const { value, results, limit, path } = query

  // If jsonObj is undefined or we have enough results we can return
  if (
    typeof jsonObj === 'undefined' ||
    (limit && results.length >= limit)) return results

  // If we ran out of path we check the following possiblities:
  if (!path.length) {
    // 1. If there is no value we can just return the object we are on
    if (value === undefined) results.push(jsonObj)
    // 2. If the value equals jsonObj, we need to return the parent
    else if (value === jsonObj) results.push(parent)
    // 3. If the jsonObj is an array, we need to decend one last time again
    else if (Array.isArray(jsonObj)) {
      jsonObj.forEach(c => searchRec(query, c, jsonObj))
    }
  } else if (typeof jsonObj === 'object') {
    // Get a mutable version of path
    let { path } = query

    // If it's a recursive token, decent into all children
    // And remove the recursive token from the path array
    if (!path[0]) {
      path = path.slice(1)
      for (const key in jsonObj) {
        searchRec(query, jsonObj[key], jsonObj)
      }
    }

    const childKey = path[0]
    const childQuery = { ...query, path: path.slice(1) }

    if (childKey === '*') {
      for (const key in jsonObj) {
        searchRec(childQuery, jsonObj[key], jsonObj)
      }
    } else {
      // Decent into child based on the first key in path
      // With jsonObj as the parent and shifted path
      searchRec(childQuery, jsonObj[childKey], jsonObj)
    }
  }

  return results
}

export const search = (query: QueryParams | string, jsonObj: any): Array<any> => {
  if (typeof query === 'string') query = { path: query }
  const { path: stringPath, ...rest } = query
  // If nothing was requested, return the current object
  if (!stringPath) return [jsonObj]
  // Tokenize the search terms
  const path = stringPath.split('.')
  // Remove the root token if exists
  if (path[0] === '$') path.shift()
  // Call the recursive search
  return searchRec({ ...rest, path, results: [] }, jsonObj)
}
