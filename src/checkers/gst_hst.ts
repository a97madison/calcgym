// GST/HST checker. Exported from Toolsloft src/tools/gst-calculator/logic.ts and
// src/tools/sales-tax-calculator/logic.ts (commit 69133650d6d6bc1d68c77e13bbe530a9d7d779c8).
// Toolsloft's gst-calculator takes a free-form rate (default 18%, which is India's GST
// slab, not Canada's). This version looks the rate up by province and date of supply from
// rules/gst_hst_rates.json (CRA table) and does exact integer-cent arithmetic.

import { loadRules } from '../rules.ts'
import { toCents, fromCents, divRoundHalfUp } from '../money.ts'
import { checkField, type GradeResult } from '../grade.ts'

export type Province = 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NT' | 'NS' | 'NU' | 'ON' | 'QC' | 'PE' | 'SK' | 'YT'
export type GstHstMode = 'add' | 'remove'

export type GstHstInput = {
  province: Province
  /** Pre-tax price in 'add' mode, tax-included total in 'remove' mode. Dollars, at most 2 decimals. */
  amount: number
  mode: GstHstMode
  /** Date of supply, YYYY-MM-DD, on or after 2013-04-01. */
  date: string
}

export type GstHstOutput = {
  taxType: 'GST' | 'HST'
  ratePct: number
  base: number
  tax: number
  total: number
}

type Rules = {
  earliest_supported_date: string
  hst_provinces: string[]
  periods: { from: string; to: string | null; rates_pct: Record<string, number> }[]
  grading_tolerance: Record<'tax' | 'base' | 'total', number>
}

export const RULES = loadRules<Rules>('gst_hst_rates.json')

function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function rateFor(province: Province, date: string): number {
  if (!isRealDate(date)) throw new Error(`bad date: ${date}`)
  if (date < RULES.earliest_supported_date) throw new Error(`date before ${RULES.earliest_supported_date} is not supported`)
  const period = RULES.periods.find((p) => date >= p.from && (p.to === null || date <= p.to))
  if (!period) throw new Error(`no rate period covers ${date}`)
  const rate = period.rates_pct[province]
  if (rate === undefined) throw new Error(`unknown province: ${province}`)
  return rate
}

export function computeGstHst(input: GstHstInput): GstHstOutput {
  const { province, amount, mode, date } = input
  if (mode !== 'add' && mode !== 'remove') throw new Error(`bad mode: ${mode}`)
  if (!(amount >= 0)) throw new Error('amount must be non-negative')
  const ratePct = rateFor(province, date)
  if (!Number.isInteger(ratePct)) throw new Error('non-integer rates need a finer scale')
  const r = BigInt(ratePct)
  const cents = toCents(amount)
  let baseC: bigint, taxC: bigint, totalC: bigint
  if (mode === 'add') {
    baseC = cents
    taxC = divRoundHalfUp(cents * r, 100n)
    totalC = baseC + taxC
  } else {
    totalC = cents
    baseC = divRoundHalfUp(cents * 100n, 100n + r)
    taxC = totalC - baseC
  }
  return {
    taxType: RULES.hst_provinces.includes(province) ? 'HST' : 'GST',
    ratePct,
    base: fromCents(baseC),
    tax: fromCents(taxC),
    total: fromCents(totalC),
  }
}

export type GstHstTask = {
  checker: 'gst_hst'
  inputs: GstHstInput
  target: 'tax' | 'base' | 'total'
}

/** Grade an answer. The expected value is recomputed from the task inputs, never read from the task file. */
export function grade(task: GstHstTask, answer: unknown): GradeResult {
  const out = computeGstHst(task.inputs)
  return checkField(task.target, out[task.target], RULES.grading_tolerance[task.target], answer)
}
