import babel from 'rollup-plugin-babel'
import replace from 'rollup-plugin-replace'

const packageJson = require('./package.json')

export default {
  entry: 'src/index.js',
  external: Object.keys(packageJson.dependencies),
  plugins: [
    replace({
      'import bcoin from \'bcoin\'': 'let bcoin = require(\'../vendor/bcoin.js\') \n let Buffer = require(\'buffer/\').Buffer\n'
    }),
    babel({})
  ],
  targets: [
    {
      dest: packageJson['main'],
      format: 'cjs',
      sourceMap: true
    },
    {
      dest: packageJson['module'],
      format: 'es',
      sourceMap: true
    }
  ]
}
