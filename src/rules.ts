import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RULES_DIR = process.env.CALCGYM_RULES_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'rules')

export function loadRules<T = any>(file: string): T {
  return JSON.parse(readFileSync(join(RULES_DIR, file), 'utf8')) as T
}
