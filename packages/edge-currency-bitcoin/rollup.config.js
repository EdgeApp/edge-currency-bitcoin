// import resolve from 'rollup-plugin-node-resolve'
// import commonjs from 'rollup-plugin-commonjs'
import { createRollupConfig } from '../../rollupConfig.js'
import packageJson from './package.json'

// Normal build:
const nodeConfig = createRollupConfig('./src/index.js', packageJson, '..')

// React Native build:
const output = { file: './lib/index.react.js', format: 'cjs', sourcemap: true }
const external = nodeConfig.external.filter(dep => dep !== 'nidavellir')

const plugins = [...nodeConfig.plugins]
const reactConfig = { ...nodeConfig, output, external, plugins }

export default [nodeConfig, reactConfig]
