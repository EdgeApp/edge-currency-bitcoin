const lazyHandler = activeModule => ({
  get: (target, prop, receiver) => {
    // If already loaded return the loaded module
    if (activeModule) return activeModule[prop]
    // Try to inject the loaded module
    if (prop === 'inject') {
      return loadedModule => {
        activeModule = loadedModule
        for (const prop in target) {
          target[prop].inject(activeModule[prop])
        }
      }
    }
    // Create a new child proxy if this prop not yet exists
    if (!target[prop]) {
      target[prop] = new Proxy(function(...args) {
        if (!activeModule) target()
        return activeModule[prop](...args)
      }, lazyHandler())
    }
    return target[prop]
  }
})

export const lazify = unsafeModule => {
  const parentModule = function(injectedModule = {}, loadUnsafe = true) {
    const defaultModule = loadUnsafe ? unsafeModule() : {}
    const loadedModule = Object.assign(defaultModule, injectedModule)
    parentProxy.inject(loadedModule)
  }
  const parentProxy = new Proxy(parentModule, lazyHandler())
  return parentProxy
}
