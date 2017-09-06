import replace from 'rollup-plugin-replace'
const packageJson = require('./package.json')

export default {
  input: 'src/index.js',
  external: Object.keys(packageJson.dependencies),
  plugins: [
    replace({
      bufferPlaceHolder: 'buffer'
    })
  ],
  output: [
    {
      file: packageJson['test'],
      format: 'cjs',
      sourcemap: true
    }
  ]
}
