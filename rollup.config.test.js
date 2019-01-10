import babel from 'rollup-plugin-babel'
import json from 'rollup-plugin-json'
import multiEntry from 'rollup-plugin-multi-entry'
import resolve from 'rollup-plugin-node-resolve'

import config from './rollup.config.js'

const babelOptions = {
  presets: ['@babel/preset-flow'],
  plugins: ['@babel/plugin-proposal-object-rest-spread']
}

export default {
  external: config.external,
  input: './test/**/*.js',
  output: [{ file: 'build/tests.cjs.js', format: 'cjs', sourcemap: true }],
  plugins: [multiEntry(), json(), babel(babelOptions), resolve()]
}
