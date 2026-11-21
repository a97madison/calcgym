// 2026 federal + Ontario personal income tax checker. Exported from Toolsloft
// src/tools/income-tax-calculator/logic.ts, src/tools/tax-bracket-calculator/logic.ts and
// src/lib/tax.ts (federalTax, marginalRate) at commit 69133650d6d6bc1d68c77e13bbe530a9d7d779c8.
// Toolsloft implements 2024 US federal brackets with a standard deduction. This version
// implements the CRA 2026 federal and Ontario rules in rules/income_tax_2026_fed_on.json:
// brackets, non-refundable credits at the lowest rate (basic personal amounts with the
// federal phase-out, plus optional extra credit amounts), Ontario surtax, Ontario Health
// Premium and the Ontario basic tax reduction. All arithmetic is in exact integer cents.

import { loadRules } from '../rules.ts'
import { toCents, fromCents, parseScaled, divRoundHalfUp, maxBig, minBig } from '../money.ts'
import { checkField, type GradeResult } from '../grade.ts'

export type TaxMethod = 'bracket' | 'payroll_constants'

export type IncomeTaxInput = {
  /** Annual taxable income in dollars. */
  taxableIncome: number
  /** Net income (line 23600). Drives the federal BPA phase-out. Defaults to taxableIncome. */
  netIncome?: number
  /** Federal non-refundable credit amounts claimed on top of the BPA (e.g. CPP, EI, Canada employment amount). Default 0. */
  extraFederalCreditAmounts?: number
  /** Ontario non-refundable credit amounts claimed on top of the Ontario BPA. Default 0. */
  extraOntarioCreditAmounts?: number
  method?: TaxMethod
}

export type IncomeTaxOutput = {
  federal_basic_tax: number
  federal_bpa: number
  federal_credits: number
  federal_tax: number
  ontario_basic_tax_on_income: number
  ontario_credits: number
  ontario_basic_tax: number
  ontario_surtax: number
  ontario_health_premium: number
  ontario_tax_reduction: number
  ontario_tax: number
  total_tax: number
}

type Bracket = { from: number; rate: string }
type Rules = {
  tax_year: number
  federal: { brackets: Bracket[]; payroll_constants_K: number[]; credit_rate: string; bpa: { max: number; min: number; phase_out_start: number; phase_out_end: number } }
  ontario: {
    brackets: Bracket[]
    payroll_constants_KP: number[]
    credit_rate: string
    bpa: number
    surtax: { over: number; rate: string }[]
    tax_reduction_basic_amount: number
    health_premium: { over: number; upto: number | null; base: number; rate: string; cap: number }[]
  }
  grading_tolerance: Record<string, number>
}

export const RULES = loadRules<Rules>('income_tax_2026_fed_on.json')

const SCALE = 4 // rates have at most 4 decimals (0.0505, 0.1116)
const RATE_DEN = 10n ** BigInt(SCALE)
const rate = (s: string) => parseScaled(s, SCALE)
const dollars = (d: number) => BigInt(d) * 100n

/** Index of the bracket that taxable income (cents) falls into. CRA brackets start at threshold + $0.01. */
function bracketIndex(brackets: Bracket[], incomeC: bigint): number {
  let idx = 0
  brackets.forEach((b, i) => {
    if (incomeC > dollars(b.from)) idx = i
  })
  return idx
}

/** Tax on income, rounded to the cent. */
export function taxOnIncome(brackets: Bracket[], constants: number[], incomeC: bigint, method: TaxMethod): bigint {
  if (method === 'payroll_constants') {
    const idx = bracketIndex(brackets, incomeC)
    return divRoundHalfUp(incomeC * rate(brackets[idx].rate), RATE_DEN) - dollars(constants[idx])
  }
  let acc = 0n // units of 1e-4 cent
  for (let i = 0; i < brackets.length; i++) {
    const lo = dollars(brackets[i].from)
    const hi = i + 1 < brackets.length ? dollars(brackets[i + 1].from) : null
    if (incomeC <= lo) break
    const top = hi === null ? incomeC : minBig(incomeC, hi)
    acc += (top - lo) * rate(brackets[i].rate)
  }
  return divRoundHalfUp(acc, RATE_DEN)
}

/** Federal BPA after the high-income phase-out, in cents, rounded half up (T4127 BPAF formula). */
export function federalBpaCents(netIncomeC: bigint): bigint {
  const { max, min, phase_out_start, phase_out_end } = RULES.federal.bpa
  if (netIncomeC <= dollars(phase_out_start)) return dollars(max)
  if (netIncomeC >= dollars(phase_out_end)) return dollars(min)
  const enhanced = BigInt(max - min)
  const span = BigInt(phase_out_end - phase_out_start)
  const num = dollars(max) * span - (netIncomeC - dollars(phase_out_start)) * enhanced
  return divRoundHalfUp(num, span)
}

export function computeIncomeTax(input: IncomeTaxInput): IncomeTaxOutput {
  const method = input.method ?? 'bracket'
  if (method !== 'bracket' && method !== 'payroll_constants') throw new Error(`bad method: ${method}`)
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === 'number' && !(v >= 0)) throw new Error(`${k} must be non-negative`)
  }
  const A = toCents(input.taxableIncome)
  const NI = toCents(input.netIncome ?? input.taxableIncome)
  const extraF = toCents(input.extraFederalCreditAmounts ?? 0)
  const extraO = toCents(input.extraOntarioCreditAmounts ?? 0)

  // Federal
  const F = RULES.federal
  const fedBasic = maxBig(0n, taxOnIncome(F.brackets, F.payroll_constants_K, A, method))
  const bpa = federalBpaCents(NI)
  const fedCredits = divRoundHalfUp((bpa + extraF) * rate(F.credit_rate), RATE_DEN)
  const fedTax = maxBig(0n, fedBasic - fedCredits)

  // Ontario
  const O = RULES.ontario
  const onOnIncome = maxBig(0n, taxOnIncome(O.brackets, O.payroll_constants_KP, A, method))
  const onCredits = divRoundHalfUp((dollars(O.bpa) + extraO) * rate(O.credit_rate), RATE_DEN)
  const T4 = maxBig(0n, onOnIncome - onCredits)
  let surAcc = 0n
  for (const s of O.surtax) surAcc += maxBig(0n, T4 - dollars(s.over)) * rate(s.rate)
  const V1 = divRoundHalfUp(surAcc, RATE_DEN)
  let V2 = 0n
  for (const h of O.health_premium) {
    if (A > dollars(h.over) && (h.upto === null || A <= dollars(h.upto))) {
      V2 = minBig(dollars(h.cap), dollars(h.base) + divRoundHalfUp((A - dollars(h.over)) * rate(h.rate), RATE_DEN))
    }
  }
  const S = maxBig(0n, minBig(T4 + V1, 2n * dollars(O.tax_reduction_basic_amount) - (T4 + V1)))
  const onTax = T4 + V1 + V2 - S

  return {
    federal_basic_tax: fromCents(fedBasic),
    federal_bpa: fromCents(bpa),
    federal_credits: fromCents(fedCredits),
    federal_tax: fromCents(fedTax),
    ontario_basic_tax_on_income: fromCents(onOnIncome),
    ontario_credits: fromCents(onCredits),
    ontario_basic_tax: fromCents(T4),
    ontario_surtax: fromCents(V1),
    ontario_health_premium: fromCents(V2),
    ontario_tax_reduction: fromCents(S),
    ontario_tax: fromCents(onTax),
    total_tax: fromCents(fedTax + onTax),
  }
}

export type IncomeTaxTask = {
  checker: 'income_tax_on'
  inputs: IncomeTaxInput
  target: 'federal_tax' | 'ontario_tax' | 'total_tax'
}

export function grade(task: IncomeTaxTask, answer: unknown): GradeResult {
  const out = computeIncomeTax(task.inputs)
  return checkField(task.target, out[task.target], RULES.grading_tolerance[task.target], answer)
}
