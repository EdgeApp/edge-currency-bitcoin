import { createRollupConfig } from '../../rollupConfig.js'
import packageJson from './package.json'

export default createRollupConfig('./index.js', packageJson, '../..')
