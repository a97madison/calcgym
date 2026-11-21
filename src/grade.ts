// Shared answer parsing and tolerance check used by every checker's grade().

export type GradeResult = {
  pass: boolean
  field: string
  expected: number
  got: number | null
  absError: number | null
  tolerance: number
  reason: string
}

const NUM = /-?\$?\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\$?\s?\d+(?:\.\d+)?/g

/**
 * Turn a model's answer into one number.
 * - A number is used as is.
 * - A string: if it contains "ANSWER:", only the text after the last "ANSWER:" counts.
 *   That text must hold exactly one number (commas, "$" and a trailing "%" are allowed).
 *   Two or more numbers there is a fail, so a reply cannot hedge with several candidates.
 */
export function parseAnswer(answer: unknown): number | null {
  if (typeof answer === 'number') return Number.isFinite(answer) ? answer : null
  if (typeof answer !== 'string') return null
  const idx = answer.lastIndexOf('ANSWER:')
  const tail = idx >= 0 ? answer.slice(idx + 'ANSWER:'.length) : answer
  const firstLine = tail.trim().split('\n')[0] ?? ''
  const matches = firstLine.match(NUM)
  if (!matches || matches.length !== 1) return null
  const cleaned = matches[0].replace(/[$,\s]/g, '')
  const v = Number(cleaned)
  return Number.isFinite(v) ? v : null
}

export function checkField(field: string, expected: number, tolerance: number, answer: unknown): GradeResult {
  const got = parseAnswer(answer)
  if (got === null) {
    return { pass: false, field, expected, got: null, absError: null, tolerance, reason: 'could not parse exactly one number from the answer' }
  }
  const absError = Math.abs(got - expected)
  // 1e-9 slack only absorbs binary float noise in the subtraction itself.
  const pass = absError <= tolerance + 1e-9
  return { pass, field, expected, got, absError, tolerance, reason: pass ? 'within tolerance' : 'outside tolerance' }
}
