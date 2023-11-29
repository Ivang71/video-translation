import { join } from 'path'
import { PythonShell } from 'python-shell'
import { pyScriptsDir } from './paths.ts'

const maxLength = 14500
const truncateString = (str: string, maxLength: number): string => {
  return str.length > maxLength ? str.substring(0, maxLength) : str
}

/**
 * Translates a batch of strings to target language. Truncates strings longer than 14 500 characters.
*/
export const translate = async (destLang: string, batch: string[]): Promise<string[]> => {
    const truncatedBatch: string[] = batch.map((str) => truncateString(str, maxLength))
    const r = await PythonShell.run('translate.py', {
        mode: 'text',
        pythonPath: 'python3',
        pythonOptions: ['-u'],
        scriptPath: join(pyScriptsDir),
        args: ['--dest', destLang, '--text', ...truncatedBatch]
    })
    return JSON.parse(r[0].replace(/'/g, '"'))
}
