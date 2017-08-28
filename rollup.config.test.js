import babel from 'rollup-plugin-babel'

const packageJson = require('./package.json')

export default {
  entry: 'src/index.js',
  external: Object.keys(packageJson.dependencies),
  plugins: [babel({})],
  targets: [
    {
      dest: packageJson['test'],
      format: 'cjs',
      sourceMap: true
    }
  ]
}
