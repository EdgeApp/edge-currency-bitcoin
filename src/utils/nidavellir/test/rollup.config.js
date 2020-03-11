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
  input: './src/utils/nidavellir/test/**/*.js',
  output: [
    {
      file: './src/utils/nidavellir/build/tests.cjs.js',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: './src/utils/nidavellir/build/tests.js',
      format: 'es',
      sourcemap: true
    }
  ],
  plugins: [multiEntry(), json(), babel(babelOptions)]
}
