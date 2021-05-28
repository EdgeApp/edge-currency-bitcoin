const path = require('path')
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')

const babelOptions = {
  // For debugging, just remove "@babel/preset-env":
  presets: ['@babel/preset-env', '@babel/preset-flow'],
  plugins: [['@babel/plugin-transform-for-of', { assumeArray: true }]],
  cacheDirectory: true
}

module.exports = {
  devtool: 'source-map',
  entry: './src/react-native.js',
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.js$/,
        use: { loader: 'babel-loader', options: babelOptions }
      }
    ]
  },
  plugins: [new webpack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'] })],
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({ terserOptions: { safari10: true } })]
  },
  resolve: {
    fallback: {
      url: require.resolve('url/'),
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream/')
    }
  },
  output: {
    path: path.resolve(__dirname, './lib/react-native/'),
    filename: 'edge-currency-bitcoin.js'
  },
  target: ['web', 'es5']
}
