import { fileURLToPath } from 'url'
import { dirname, join } from 'path'


const currentModuleFile = fileURLToPath(import.meta.url)
const currentDir = dirname(currentModuleFile)
export const rootDir = join(currentDir, '..', '..')
export const assetsDir = join(rootDir, 'assets')
export const srcDir = join(rootDir, 'src')
export const pyScriptsDir = join(srcDir, 'pyScripts')
export const credsDir = join(rootDir, 'credentials')
export const logsDir = join(rootDir, 'logs')
