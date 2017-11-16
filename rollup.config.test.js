import config from './rollup.config.js'
import multiEntry from 'rollup-plugin-multi-entry'

export default {
  external: config.external,
  input: 'src/**/*.test.js',
  output: [{ file: 'build/tests.cjs.js', format: 'cjs' }],
  plugins: [multiEntry(), ...config.plugins],
  sourcemap: true
}
