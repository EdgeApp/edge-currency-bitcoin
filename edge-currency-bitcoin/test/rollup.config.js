import alias from 'rollup-plugin-alias'
import babel from 'rollup-plugin-babel'
import json from 'rollup-plugin-json'
import multiEntry from 'rollup-plugin-multi-entry'

import config from '../rollup.config.js'

const babelOptions = {
  babelrc: false,
  presets: ['@babel/preset-flow'],
  plugins: ['@babel/plugin-proposal-object-rest-spread']
}

export default {
  external: config.external,
  input: './test/**/*.js',
  output: [{ file: 'build/tests.js', format: 'cjs', sourcemap: true }],
  plugins: [
    multiEntry(),
    json(),
    alias({ 'buffer-hack': 'buffer' }),
    babel(babelOptions)
  ]
}
