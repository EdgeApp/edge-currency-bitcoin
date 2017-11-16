import babel from 'rollup-plugin-babel'
import json from 'rollup-plugin-json'
import packageJson from './package.json'
import replace from 'rollup-plugin-replace'

const babelConf = {
  presets: ['flow']
}

export default {
  external: [
    ...Object.keys(packageJson.dependencies),
    ...Object.keys(packageJson.devDependencies)
  ],
  input: './src/plugin-index.js',
  output: [
    { file: packageJson.main, format: 'cjs' },
    { file: packageJson.module, format: 'es' }
  ],
  plugins: [
    json(),
    replace({
      bufferPlaceHolder: 'buffer/'
    }),
    babel(babelConf)
  ],
  sourcemap: true
}
