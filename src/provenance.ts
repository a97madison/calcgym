// Append-only provenance log helpers. See provenance/README.md for the schema.
import { readFileSync, appendFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const LOG = join(ROOT, 'provenance', 'log.jsonl')
export const TOOLSLOFT_COMMIT = '69133650d6d6bc1d68c77e13bbe530a9d7d779c8'
export const AGENT_AUTHOR = 'CalcGym agent (Grok Bot build agent), original work'
export const TEMPLATE_AUTHOR = 'CalcGym template, written by CalcGym agent'

/** Current time as ISO 8601 with the America/Toronto UTC offset, e.g. 2026-11-20T23:30:00-05:00 */
export function torontoNow(d = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset',
    }).formatToParts(d).map((p) => [p.type, p.value]),
  )
  const off = (parts.timeZoneName as string).replace('GMT', '') || '+00:00'
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${off}`
}

export const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')
export const sha256File = (rel: string) => sha256(readFileSync(join(ROOT, rel)))

export function readLog(): any[] {
  if (!existsSync(LOG)) return []
  return readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

const REQUIRED = ['id', 'kind', 'created_at', 'author', 'source', 'generator', 'human_review', 'license']

/**
 * Append one entry. Never rewrites earlier lines. If an entry with the same id exists and
 * its content hash matches, nothing is written (idempotent re-runs). If the hash differs the
 * call throws: a changed artifact needs a new versioned id.
 */
export function appendEntry(entry: Record<string, any>): 'appended' | 'unchanged' {
  for (const k of REQUIRED) if (entry[k] === undefined) throw new Error(`provenance entry missing ${k}`)
  if (!Array.isArray(entry.source) || entry.source.length === 0) throw new Error('source must be a non-empty list')
  const prior = readLog().filter((e) => e.id === entry.id)
  if (prior.length) {
    if (prior[prior.length - 1].sha256 === entry.sha256) return 'unchanged'
    throw new Error(`provenance id ${entry.id} already logged with a different sha256; bump the version`)
  }
  appendFileSync(LOG, JSON.stringify(entry) + '\n')
  return 'appended'
}
