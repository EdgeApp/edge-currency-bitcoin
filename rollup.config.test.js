import alias from 'rollup-plugin-alias'
import babel from 'rollup-plugin-babel'
import json from 'rollup-plugin-json'
import multiEntry from 'rollup-plugin-multi-entry'
import resolve from 'rollup-plugin-node-resolve'

import config from './rollup.config.js'

const babelOptions = {
  presets: ['@babel/preset-flow'],
  plugins: [
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-transform-exponentiation-operator',
    '@babel/plugin-proposal-export-default-from',
    '@babel/plugin-proposal-export-namespace-from'
  ]
}

export default {
  external: config.external,
  input: './test/**/*.js',
  output: [{ file: 'build/tests.cjs.js', format: 'cjs', sourcemap: true }],
  plugins: [
    multiEntry(),
    json(),
    alias({ 'buffer-hack': 'buffer' }),
    babel(babelOptions),
    resolve()
  ]
}
