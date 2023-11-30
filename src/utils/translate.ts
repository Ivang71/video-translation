import { join } from 'path'
import { PythonShell } from 'python-shell'
import { pyScriptsDir } from './paths.ts'

const maxLength = 14500
const truncateString = (str: string, maxLength: number): string => {
  return str.length > maxLength ? str.substring(0, maxLength) : str
}

const sanitizeJSON = (s: string): string => {
    try {
      // Parse the JSON to detect syntax errors
      JSON.parse(s);
  
      // If parsing succeeds, no syntax errors, return the original string
      return s;
    } catch (error) {
      // If there's a syntax error, remove the bad escaped character and try again
      if (error instanceof SyntaxError) {
        const positionMatch = error.message.match(/\d+/);
        if (positionMatch) {
          const position = Number(positionMatch[0]);
          const sanitizedJSON = s.slice(0, position - 1) + s.slice(position);
          return sanitizeJSON(sanitizedJSON);
        }
      }
  
      // If it's not a SyntaxError or position cannot be determined, rethrow the error
      throw error;
    }
  }

/**
 * Translates a batch of strings to target language. Truncates strings longer than 14 500 characters.
*/
export const translate = async (destLang: string, batch: string[]) => {
    const truncatedBatch: string[] = batch.map((str) => truncateString(str, maxLength))
    let r: string = (await PythonShell.run('translate.py', {
        mode: 'text',
        pythonPath: 'python3',
        pythonOptions: ['-u'],
        scriptPath: join(pyScriptsDir),
        args: ['--dest', destLang, '--text', ...truncatedBatch]
    }))[0]
    r = sanitizeJSON(r.replace(/[\x00-\x1F\x7F-\x9F]/g, '').replaceAll(/\'/g, '"').replaceAll(/\n/g, '\\n'))
    return JSON.parse(r)
}
