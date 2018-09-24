import alias from 'rollup-plugin-alias'
import babel from 'rollup-plugin-babel'
import json from 'rollup-plugin-json'
import resolve from 'rollup-plugin-node-resolve'

import packageJson from './package.json'

const babelOptions = {
  presets: ['@babel/preset-flow'],
  plugins: [
    '@babel/plugin-proposal-object-rest-spread'
  ]
}

export default {
  external: [
    ...Object.keys(packageJson.dependencies),
    ...Object.keys(packageJson.devDependencies),
    'buffer/',
    'crypto',
    'events',
    'net',
    'tls'
  ],
  input: './src/index.js',
  output: [
    { file: packageJson.main, format: 'cjs', sourcemap: true },
    { file: packageJson.module, format: 'es', sourcemap: true }
  ],
  plugins: [
    json(),
    alias({ 'buffer-hack': 'buffer/' }),
    babel(babelOptions),
    resolve()
  ]
}
