// @flow

import type { LoadFunc, PersistStatus, SaveFunc } from '../../types/utils.js'

export const persist = (
  save: SaveFunc,
  load: LoadFunc | Object,
  delay: number = 100,
  cache: Object = {},
  data: Object = cache,
  status: PersistStatus = {}
) => {
  return new Proxy(Object.assign(newCache => save(newCache || cache), data), {
    apply: async (target, thisArgs, args) => {
      // Try to load the cache from disk in case it never happend before
      if (!status.loaded) {
        const rawData = typeof load === 'function' ? await load() : load
        cache = { ...rawData, ...cache }
        data = cache
        status.loaded = true
        for (const key in data) {
          if (target[key] === undefined) {
            Reflect.set(target, key, data[key])
          }
        }
      }
      // Stop looping in case nothing changed
      if (!status.changed) return

      // If something changed, set flags and call save
      status.changed = false
      await Reflect.apply(target, target, args)

      // Set save loop after the desired delay
      status.saving = setTimeout(() => {
        status.saving = false
        Reflect.apply(thisArgs, thisArgs, [])
      }, delay)
    },
    set: (target: Object, prop: string, value: any, receiver: Function) => {
      // Only update/save if the param actually changed
      if (data[prop] !== value) {
        Reflect.set(data, prop, value)
        Reflect.set(target, prop, value)
        status.changed = true
        if (!status.saving) Reflect.apply(receiver, receiver, [])
      }
      return true
    },
    get: (target: Object, prop: string) => {
      // Get the value
      const value = Reflect.get(data, prop)
      // Return any non object values
      if (typeof value !== 'object') return value
      // Create a proxy from the child to trimgger saves on the top parent
      return persist(save, load, delay, cache, value, status)
    }
  })
}
