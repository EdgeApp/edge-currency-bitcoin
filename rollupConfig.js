import babel from 'rollup-plugin-babel'
import flowEntry from 'rollup-plugin-flow-entry'
import json from 'rollup-plugin-json'

import mainPackageJson from './package.json'

export const createExternalSettings = ({ dependencies, devDependencies }) => {
  const deps = [
    'bindings',
    'elliptic',
    ...Object.keys({ ...dependencies, ...devDependencies })
  ]
  const externalFilter = dep => !/^@?nidavellir(\/|-){1}.*$/i.test(dep)
  return deps.filter(externalFilter)
}

export const createOutput = packageJson => [
  { file: packageJson.main, format: 'cjs', sourcemap: true },
  { file: packageJson.module, format: 'es', sourcemap: true }
]

export const createPlugins = parentPath => {
  const babelOptions = {
    babelrc: false,
    presets: ['@babel/preset-flow'],
    plugins: ['@babel/plugin-proposal-object-rest-spread']
  }
  return [json(), babel(babelOptions), flowEntry()]
}

const mainExternal = createExternalSettings(mainPackageJson)

export const createRollupConfig = (input, packageJson, parentPath) => {
  return {
    input,
    external: [...createExternalSettings(packageJson), ...mainExternal],
    output: createOutput(packageJson),
    plugins: createPlugins(parentPath)
  }
}
