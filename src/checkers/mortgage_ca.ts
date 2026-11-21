// Canadian mortgage payment checker. Exported from Toolsloft
// src/tools/mortgage-calculator/logic.ts and src/lib/finance.ts (monthlyPayment,
// amortizationSchedule) at commit 69133650d6d6bc1d68c77e13bbe530a9d7d779c8.
// Toolsloft uses a US-style periodic rate (annual / 12, compounded monthly). A Canadian
// fixed-rate mortgage quotes the rate compounded half-yearly, not in advance (Interest Act
// s. 6), so the periodic rate here is i = (1 + j/m)^(m/k) - 1.

import { loadRules } from '../rules.ts'
import { round2 } from '../money.ts'
import { checkField, type GradeResult } from '../grade.ts'

export type Compounding = 'semi-annual' | 'annual'
export type PaymentFrequency = 'monthly' | 'semi-monthly' | 'bi-weekly' | 'weekly'

export type MortgageInput = {
  principal: number
  /** Quoted nominal annual rate in percent, e.g. 4.79 */
  annualRatePct: number
  amortizationYears: number
  paymentFrequency: PaymentFrequency
  compounding?: Compounding
  /** Optional term length in whole years, for the balance owing at renewal. Must be less than amortizationYears. */
  termYears?: number
}

export type MortgageOutput = {
  paymentsPerYear: number
  numberOfPayments: number
  periodicRate: number
  payment: number
  total_interest: number
  effective_annual_rate_pct: number
  balance_after_term: number | null
}

type Rules = {
  compounding_periods_per_year: Record<Compounding, number>
  default_compounding: Compounding
  payment_frequencies: Record<PaymentFrequency, number>
  grading_tolerance: Record<string, number>
}

export const RULES = loadRules<Rules>('mortgage_ca.json')

export function computeMortgage(input: MortgageInput): MortgageOutput {
  const { principal, annualRatePct, amortizationYears, paymentFrequency } = input
  const compounding = input.compounding ?? RULES.default_compounding
  const m = RULES.compounding_periods_per_year[compounding]
  const k = RULES.payment_frequencies[paymentFrequency]
  if (!m) throw new Error(`bad compounding: ${compounding}`)
  if (!k) throw new Error(`bad payment frequency: ${paymentFrequency}`)
  if (!(principal > 0) || !Number.isFinite(principal)) throw new Error('principal must be positive')
  if (!(annualRatePct >= 0) || !Number.isFinite(annualRatePct)) throw new Error('rate must be non-negative')
  if (!Number.isInteger(amortizationYears) || amortizationYears < 1 || amortizationYears > 40) throw new Error('amortization must be 1 to 40 whole years')
  const n = amortizationYears * k
  const j = annualRatePct / 100
  const i = j === 0 ? 0 : Math.pow(1 + j / m, m / k) - 1
  const raw = i === 0 ? principal / n : (principal * i) / (1 - Math.pow(1 + i, -n))
  const payment = round2(raw)

  let balance: number | null = null
  if (input.termYears !== undefined) {
    const t = input.termYears
    if (!Number.isInteger(t) || t < 1 || t >= amortizationYears) throw new Error('termYears must be a whole number below amortizationYears')
    const p = t * k
    const b = i === 0 ? principal - payment * p : principal * Math.pow(1 + i, p) - (payment * (Math.pow(1 + i, p) - 1)) / i
    balance = round2(Math.max(0, b))
  }
  return {
    paymentsPerYear: k,
    numberOfPayments: n,
    periodicRate: i,
    payment,
    total_interest: round2(raw * n - principal),
    effective_annual_rate_pct: (Math.pow(1 + j / m, m) - 1) * 100,
    balance_after_term: balance,
  }
}

export type MortgageTask = {
  checker: 'mortgage_ca'
  inputs: MortgageInput
  target: 'payment' | 'total_interest' | 'balance_after_term' | 'effective_annual_rate_pct'
}

export function grade(task: MortgageTask, answer: unknown): GradeResult {
  const out = computeMortgage(task.inputs)
  const expected = out[task.target]
  if (expected === null) throw new Error('task asks for balance_after_term but has no termYears')
  return checkField(task.target, expected, RULES.grading_tolerance[task.target], answer)
}
