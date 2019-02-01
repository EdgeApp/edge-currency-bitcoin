// @flow

import type { KeyTree } from './types.js'

const keyMap = <In, Out>(
  keyTree: KeyTree<In>,
  func: (key: In) => Out
): KeyTree<Out> => {
  const { children, key, ...rest } = keyTree
  const newChildren = {}
  for (const path in children) {
    newChildren[path] = keyMap(children[path], func)
  }
  const newKey = key ? { key: func(key) } : {}
  return {
    ...rest,
    ...newKey,
    children: newChildren
  }
}

export default keyMap
