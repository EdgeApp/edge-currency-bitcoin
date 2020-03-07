// @flow

import {
  type LoadFunc,
  type PersistStatus,
  type SaveFunc
} from "../types/utils.js";

export const persist = (
  save: SaveFunc,
  load: LoadFunc | Object,
  delay: number = 100,
  cache: Object = {},
  data: Object = cache,
  status: PersistStatus = {}
) => {
  return new Proxy((Object.assign(() => save(cache), data): any), {
    apply: async (target, thisArgs, args) => {
      const updateCache = newCache => {
        cache = newCache;
        data = newCache;
        for (const key in target) {
          if (data[key] === undefined) {
            delete target[key];
          }
        }
        Object.assign(target, newCache);
      };

      // Try to load the cache from disk in case it never happend before
      if (!status.loaded) {
        const rawData = typeof load === "function" ? await load() : load;
        updateCache({ ...rawData, ...cache });
        status.loaded = true;
      }

      // Load/Stop the cache based on the argument
      if (args && args.length) {
        if (typeof args[0] === "object") updateCache({ ...args[0] });
        else if (args[0] === "stop") {
          if (status.saving) {
            clearTimeout(status.saving);
            status.saving = null;
          }
          status.changed = false;
          await Reflect.apply(target, target, []);
          return;
        }
      }

      // Stop looping in case nothing changed or we already have a save timer
      if (!status.changed || status.saving) return;

      // If something changed, set flags and call save
      status.changed = false;

      // Set save loop after the desired delay
      status.saving = setTimeout(() => {
        if (status.saving) {
          clearTimeout(status.saving);
          status.saving = null;
        }
        Reflect.apply(thisArgs, thisArgs, []);
      }, delay);

      await Reflect.apply(target, target, []);
    },
    set: (target: any, prop: string, value: any, receiver: any) => {
      // Only update/save if the param actually changed
      if (data[prop] !== value) {
        Reflect.set(data, prop, value);
        Reflect.set(target, prop, value);
        status.changed = true;
        if (!status.saving) Reflect.apply(receiver, receiver, []);
      }
      return true;
    },
    get: (target: any, prop: string) => {
      if (prop === "status") return status;
      // Get the value
      const value = Reflect.get(data, prop);
      // Return any non object values
      if (typeof value !== "object") return value;
      // Create a proxy from the child to trimgger saves on the top parent
      return persist(save, load, delay, cache, value, status);
    }
  });
};
