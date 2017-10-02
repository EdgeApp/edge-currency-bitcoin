import replace from 'rollup-plugin-replace'
import babel from 'rollup-plugin-babel'

const packageJson = require('./package.json')

const babelConf = {
  'presets': ['flow']
}

export default {
  input: 'src/index.js',
  external: Object.keys(packageJson.dependencies),
  plugins: [
    replace({
      bufferPlaceHolder: 'buffer'
    }),
    babel(babelConf)
  ],
  output: [
    {
      file: packageJson['test'],
      format: 'cjs',
      sourcemap: true
    }
  ]
}
