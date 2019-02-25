// @flow

import babel from 'rollup-plugin-babel'
import flowEntry from 'rollup-plugin-flow-entry'
import json from 'rollup-plugin-json'

import packageJson from './package.json'

export default {
  input: './index.js',
  output: [
    { file: packageJson.main, format: 'cjs', sourcemap: true },
    { file: packageJson.module, format: 'es', sourcemap: true }
  ],
  plugins: [
    json(),
    babel({
      babelrc: false,
      presets: ['@babel/preset-flow'],
      plugins: ['@babel/plugin-proposal-object-rest-spread']
    }),
    flowEntry()
  ]
}
