// Fixed test cases for the three checkers and the shared grader.
// CRA worked examples are reproduced exactly where CRA publishes them (T4032-ON 2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeGstHst, rateFor, grade as gradeGst } from '../src/checkers/gst_hst.ts'
import { computeMortgage, grade as gradeMortgage } from '../src/checkers/mortgage_ca.ts'
import { computeIncomeTax, federalBpaCents, RULES as TAX, grade as gradeTax } from '../src/checkers/income_tax_on.ts'
import { parseAnswer } from '../src/grade.ts'

// ---------------------------------------------------------------- GST/HST
test('gst_hst: Ontario 13% HST on $100', () => {
  assert.deepEqual(computeGstHst({ province: 'ON', amount: 100, mode: 'add', date: '2026-01-15' }), { taxType: 'HST', ratePct: 13, base: 100, tax: 13, total: 113 })
})
test('gst_hst: Quebec charges 5% GST only (QST is out of scope)', () => {
  assert.deepEqual(computeGstHst({ province: 'QC', amount: 80, mode: 'add', date: '2026-03-01' }), { taxType: 'GST', ratePct: 5, base: 80, tax: 4, total: 84 })
})
test('gst_hst: remove mode backs tax out of a tax-included total', () => {
  assert.deepEqual(computeGstHst({ province: 'ON', amount: 113, mode: 'remove', date: '2026-01-15' }), { taxType: 'HST', ratePct: 13, base: 100, tax: 13, total: 113 })
})
test('gst_hst: rate change dates from the CRA table', () => {
  assert.equal(rateFor('NS', '2025-03-31'), 15)
  assert.equal(rateFor('NS', '2025-04-01'), 14)
  assert.equal(rateFor('NB', '2016-09-30'), 13)
  assert.equal(rateFor('NB', '2016-10-01'), 15)
  assert.equal(rateFor('NL', '2016-06-30'), 13)
  assert.equal(rateFor('NL', '2016-07-01'), 15)
  assert.equal(rateFor('PE', '2016-09-30'), 14)
  assert.equal(rateFor('PE', '2016-10-01'), 15)
  assert.equal(rateFor('AB', '2013-04-01'), 5)
})
test('gst_hst: half cent rounds up ($0.50 at 13% = $0.065 -> $0.07)', () => {
  assert.equal(computeGstHst({ province: 'ON', amount: 0.5, mode: 'add', date: '2026-01-01' }).tax, 0.07)
})
test('gst_hst: rejects bad input', () => {
  assert.throws(() => computeGstHst({ province: 'ON', amount: 10, mode: 'add', date: '2013-03-31' }))
  assert.throws(() => computeGstHst({ province: 'ON', amount: 10, mode: 'add', date: '2025-02-30' }))
  assert.throws(() => computeGstHst({ province: 'ON', amount: 10.005, mode: 'add', date: '2025-02-03' }))
  assert.throws(() => computeGstHst({ province: 'ON', amount: -1, mode: 'add', date: '2025-02-03' }))
  assert.throws(() => computeGstHst({ province: 'XX' as any, amount: 1, mode: 'add', date: '2025-02-03' }))
})

// ---------------------------------------------------------------- mortgage
test('mortgage_ca: zero rate is principal / payments', () => {
  assert.equal(computeMortgage({ principal: 120000, annualRatePct: 0, amortizationYears: 10, paymentFrequency: 'monthly' }).payment, 1000)
})
test('mortgage_ca: 5% compounded semi-annually is a 5.0625% effective annual rate', () => {
  const r = computeMortgage({ principal: 100000, annualRatePct: 5, amortizationYears: 25, paymentFrequency: 'monthly' })
  assert.ok(Math.abs(r.effective_annual_rate_pct - 5.0625) < 1e-9)
  assert.ok(Math.abs(r.periodicRate - (Math.pow(1.025, 1 / 6) - 1)) < 1e-15)
  assert.ok(Math.abs(Math.pow(1 + r.periodicRate, 12) - 1.050625) < 1e-12)
})
test('mortgage_ca: annual compounding uses (1+j)^(1/k) - 1', () => {
  const r = computeMortgage({ principal: 100000, annualRatePct: 6, amortizationYears: 25, paymentFrequency: 'monthly', compounding: 'annual' })
  assert.ok(Math.abs(r.periodicRate - (Math.pow(1.06, 1 / 12) - 1)) < 1e-15)
})
test('mortgage_ca: semi-annual payment is below the Toolsloft US-style (monthly compounding) payment', () => {
  // Toolsloft src/lib/finance.ts monthlyPayment, r = annual/12
  const us = (P: number, pct: number, n: number) => { const r = pct / 1200; return (P * r * (1 + r) ** n) / ((1 + r) ** n - 1) }
  const ca = computeMortgage({ principal: 500000, annualRatePct: 4.79, amortizationYears: 25, paymentFrequency: 'monthly' }).payment
  assert.ok(ca < us(500000, 4.79, 300))
})
test('mortgage_ca: FCAC 2009 sample box consistency check (inferred, not an official breakdown)', () => {
  // FCAC sample: $255,450 at 5.50% compounded twice a year, 20-year amortization, payment
  // $1,948.28 "includes ... your monthly property tax portion". Our P&I is $1,748.28, which
  // leaves exactly $200.00 for property tax. FCAC does not state the split, so this is a
  // plausibility check only.
  const r = computeMortgage({ principal: 255450, annualRatePct: 5.5, amortizationYears: 20, paymentFrequency: 'monthly' })
  assert.equal(r.payment, 1748.28)
  assert.equal(Math.round((1948.28 - r.payment) * 100), 20000)
})
test('mortgage_ca: balance after the final year of a 1-year-shorter term is small and positive', () => {
  const r = computeMortgage({ principal: 300000, annualRatePct: 4, amortizationYears: 25, paymentFrequency: 'monthly', termYears: 24 })
  assert.ok(r.balance_after_term! > 0 && r.balance_after_term! < 12 * r.payment)
})
test('mortgage_ca: rejects bad input', () => {
  assert.throws(() => computeMortgage({ principal: 0, annualRatePct: 4, amortizationYears: 25, paymentFrequency: 'monthly' }))
  assert.throws(() => computeMortgage({ principal: 1000, annualRatePct: 4, amortizationYears: 25.5, paymentFrequency: 'monthly' }))
  assert.throws(() => computeMortgage({ principal: 1000, annualRatePct: 4, amortizationYears: 25, paymentFrequency: 'daily' as any }))
  assert.throws(() => computeMortgage({ principal: 1000, annualRatePct: 4, amortizationYears: 25, paymentFrequency: 'monthly', termYears: 25 }))
})

// ---------------------------------------------------------------- income tax
test('income_tax_on: CRA T4032-ON 2026 worked example 1 (below YMPE) reproduced to the cent', () => {
  // T4032-ON Jan 2026, "Example - Annual Pensionable Income Below YMPE". Extra credit amounts
  // are CRA's own CPP base (3,173.04), EI (1,101.88) and Canada employment amount (1,501.00).
  const r = computeIncomeTax({ taxableIncome: 62798.84, extraFederalCreditAmounts: 3173.04 + 1101.88 + 1501, extraOntarioCreditAmounts: 3173.04 + 1101.88, method: 'payroll_constants' })
  assert.equal(r.federal_basic_tax, 9069.76) // line 9
  assert.equal(r.federal_credits, 3111.91) // line 12
  assert.equal(r.federal_tax, 5957.85) // line 13
  assert.equal(r.ontario_basic_tax_on_income, 3536.09) // line 16
  assert.equal(r.ontario_credits, 871.83) // line 19
  assert.equal(r.ontario_basic_tax, 2664.26) // line 20
  assert.equal(r.ontario_surtax, 0) // line 21
  assert.equal(r.ontario_health_premium, 600) // line 23
  assert.equal(r.ontario_tax_reduction, 0) // line 25
  assert.equal(r.ontario_tax, 3264.26) // line 26
  assert.equal(r.total_tax, 9222.11) // line 27
})
test('income_tax_on: CRA T4032-ON 2026 worked example 2 (above YMPE) reproduced to the cent', () => {
  const r = computeIncomeTax({ taxableIncome: 79872, extraFederalCreditAmounts: 3519.45 + 1123.07 + 1501, extraOntarioCreditAmounts: 3519.45 + 1123.07, method: 'payroll_constants' })
  assert.equal(r.federal_basic_tax, 12569.76)
  assert.equal(r.federal_credits, 3163.37)
  assert.equal(r.federal_tax, 9406.39)
  assert.equal(r.ontario_basic_tax_on_income, 5098.29)
  assert.equal(r.ontario_credits, 890.39)
  assert.equal(r.ontario_basic_tax, 4207.9)
  assert.equal(r.ontario_health_premium, 750)
  assert.equal(r.ontario_tax, 4957.9)
  assert.equal(r.total_tax, 14364.29)
})
test('income_tax_on: bracket method stays within $1 of the payroll shortcut on the CRA examples', () => {
  for (const [A, f, o] of [[62798.84, 5775.92, 4274.92], [79872, 6143.52, 4642.52]]) {
    const b = computeIncomeTax({ taxableIncome: A, extraFederalCreditAmounts: f, extraOntarioCreditAmounts: o })
    const p = computeIncomeTax({ taxableIncome: A, extraFederalCreditAmounts: f, extraOntarioCreditAmounts: o, method: 'payroll_constants' })
    assert.ok(Math.abs(b.total_tax - p.total_tax) < 1)
  }
})
test('income_tax_on: income equal to the federal BPA owes nothing; Ontario reduction wipes out the small Ontario tax', () => {
  const r = computeIncomeTax({ taxableIncome: 16452 })
  assert.equal(r.federal_basic_tax, 2303.28)
  assert.equal(r.federal_tax, 0)
  assert.equal(r.ontario_basic_tax_on_income, 830.83)
  assert.equal(r.ontario_credits, 655.94)
  assert.equal(r.ontario_basic_tax, 174.89)
  assert.equal(r.ontario_tax_reduction, 174.89)
  assert.equal(r.ontario_tax, 0)
})
test('income_tax_on: $150,000 hits both Ontario surtax tiers (hand-computed)', () => {
  const r = computeIncomeTax({ taxableIncome: 150000 })
  assert.equal(r.ontario_basic_tax_on_income, 12363.99)
  assert.equal(r.ontario_basic_tax, 11708.05)
  assert.equal(r.ontario_surtax, 2712.35)
  assert.equal(r.ontario_health_premium, 750)
  assert.equal(r.ontario_tax, 15170.4)
})
test('income_tax_on: federal BPA phase-out (T4127 formula, 2026 amounts)', () => {
  assert.equal(federalBpaCents(18144000n), 1645200n)
  assert.equal(federalBpaCents(25848200n), 1482900n)
  assert.equal(federalBpaCents(21996100n), 1564050n) // 16452 - 38521 * 1623/77042 = 15640.50
  assert.equal(TAX.federal.bpa.max - TAX.federal.bpa.min, 1623) // CRA indexation page: enhanced amount $1,623
})
test('income_tax_on: Ontario Health Premium tiers', () => {
  const ohp = (A: number) => computeIncomeTax({ taxableIncome: A }).ontario_health_premium
  assert.equal(ohp(20000), 0)
  assert.equal(ohp(25000), 300)
  assert.equal(ohp(22000), 120)
  assert.equal(ohp(40000), 450)
  assert.equal(ohp(49000), 600)
  assert.equal(ohp(72000.01), 600)
  assert.equal(ohp(100000), 750)
  assert.equal(ohp(200000.01), 750)
  assert.equal(ohp(201000), 900)
})
test('income_tax_on: rejects negative income', () => {
  assert.throws(() => computeIncomeTax({ taxableIncome: -1 }))
})

// ---------------------------------------------------------------- grading
test('grade: parses the ANSWER line and applies tolerance', () => {
  assert.equal(parseAnswer('Work...\nANSWER: $1,234.56'), 1234.56)
  assert.equal(parseAnswer('ANSWER: 5.0625%'), 5.0625)
  assert.equal(parseAnswer('ANSWER: 12 or 13'), null)
  assert.equal(parseAnswer('no number'), null)
  const task = { checker: 'gst_hst' as const, inputs: { province: 'ON' as const, amount: 100, mode: 'add' as const, date: '2026-01-01' }, target: 'tax' as const }
  assert.equal(gradeGst(task, 'ANSWER: 13.00').pass, true)
  assert.equal(gradeGst(task, 'ANSWER: 13.01').pass, true)
  assert.equal(gradeGst(task, 'ANSWER: 13.02').pass, false)
  assert.equal(gradeGst(task, 'ANSWER: 13 (or 5 if GST only)').pass, false)
  const m = { checker: 'mortgage_ca' as const, inputs: { principal: 255450, annualRatePct: 5.5, amortizationYears: 20, paymentFrequency: 'monthly' as const }, target: 'payment' as const }
  assert.equal(gradeMortgage(m, 'ANSWER: 1748.28').pass, true)
  assert.equal(gradeMortgage(m, 'ANSWER: 1757.18').pass, false)
  const t = { checker: 'income_tax_on' as const, inputs: { taxableIncome: 150000 }, target: 'ontario_tax' as const }
  assert.equal(gradeTax(t, 'ANSWER: 15170.40').pass, true)
  assert.equal(gradeTax(t, 'ANSWER: 14420.40').pass, false) // forgot the health premium
})
