// Deterministic task generator for CalcGym v0. No model is called anywhere in this file.
// Each task is fully determined by (template_id, seed). Expected answers come from the
// TypeScript checkers; tests/test_oracle.py re-derives every one with the Python oracle.
//
// Usage: node tasks/generate.ts [perChecker=10] [outFile=tasks/v0-sample.jsonl]
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { computeGstHst, RULES as GST, type Province } from '../src/checkers/gst_hst.ts'
import { computeMortgage, RULES as MORT, type PaymentFrequency, type Compounding } from '../src/checkers/mortgage_ca.ts'
import { computeIncomeTax, RULES as TAX } from '../src/checkers/income_tax_on.ts'
import { ROOT, appendEntry, torontoNow, sha256, TEMPLATE_AUTHOR } from '../src/provenance.ts'

const PER = Number(process.argv[2] ?? 10)
const OUT = process.argv[3] ?? 'tasks/v0-sample.jsonl'
// DRY=1 writes the task file but skips provenance (for previews only; never ship a DRY file)
const SET = OUT.replace(/^.*\//, '').replace(/\.jsonl$/, '')
const BASE_SEED = 20261120

// mulberry32: small, well-known 32-bit PRNG, so a seed reproduces the same task in any JS runtime.
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type R = () => number
const pick = <T,>(r: R, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]
const int = (r: R, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
const cents = (r: R, lo: number, hi: number) => Math.round((lo + r() * (hi - lo)) * 100) / 100
const fmt = (x: number) => x.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt0 = (x: number) => x.toLocaleString('en-CA', { maximumFractionDigits: 2 })
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const longDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}` }
const randDate = (r: R, from: string, to: string) => {
  const a = Date.parse(from + 'T00:00:00Z'), b = Date.parse(to + 'T00:00:00Z')
  return new Date(a + Math.floor(r() * ((b - a) / 86400000 + 1)) * 86400000).toISOString().slice(0, 10)
}
const ANSWER_LINE = 'End your reply with one line in the form ANSWER: <number>, with no other numbers on that line.'
const NAMES = ['Amara', 'Luc', 'Mei', 'Daniel', 'Farah', 'Tomas', 'Grace', 'Arjun', 'Noor', 'Owen', 'Sofia', 'Kwame']

const cite = (rules: any) => rules.citations.map((c: any) => ({ url: c.url, title: c.title, retrieved: c.retrieved }))

type Built = { template_id: string; prompt: string; inputs: any; target: string; unit: string; context: Record<string, any> }

// ---------------------------------------------------------------- GST/HST templates
const ALL_PROV = Object.keys(GST.province_names) as Province[]
const NO_SEPARATE_PST = ['AB', 'NT', 'NU', 'YT', 'ON', 'NB', 'NL', 'NS', 'PE'] as Province[]
const gstTemplates: ((r: R) => Built)[] = [
  (r) => {
    const province = pick(r, ALL_PROV), amount = cents(r, 5, 4000), date = randDate(r, '2014-01-01', '2026-11-20')
    const name = GST.province_names[province]
    return { template_id: 'gst_hst.add.tax.v1', target: 'tax', unit: 'CAD', inputs: { province, amount, mode: 'add', date }, context: {},
      prompt: `A shop in ${name} sells a taxable item for $${fmt(amount)} before tax on ${longDate(date)}. The regular GST/HST rate for ${name} on that date applies, and the place of supply is ${name}. How much GST/HST does the shop charge? Leave out any provincial sales tax that is charged separately from GST/HST. Round to the cent. ${ANSWER_LINE}` }
  },
  (r) => {
    const province = pick(r, ALL_PROV), amount = cents(r, 20, 25000), date = randDate(r, '2014-01-01', '2026-11-20')
    const name = GST.province_names[province]
    return { template_id: 'gst_hst.add.total.v1', target: 'total', unit: 'CAD', inputs: { province, amount, mode: 'add', date }, context: {},
      prompt: `An invoice dated ${longDate(date)} is for $${fmt(amount)} of taxable services supplied in ${name}, before tax. What is the invoice total once GST/HST at the regular rate for ${name} on that date is added? Count GST/HST only, not any separate provincial sales tax. Round to the cent. ${ANSWER_LINE}` }
  },
  (r) => {
    const province = pick(r, NO_SEPARATE_PST), amount = cents(r, 10, 8000), date = randDate(r, '2014-01-01', '2026-11-20')
    const name = GST.province_names[province]
    return { template_id: 'gst_hst.remove.base.v1', target: 'base', unit: 'CAD', inputs: { province, amount, mode: 'remove', date }, context: {},
      prompt: `A receipt from ${name} dated ${longDate(date)} shows a total of $${fmt(amount)}. That total includes GST/HST at the regular rate for ${name} on that date and no other tax. What was the price before tax? Round to the cent. ${ANSWER_LINE}` }
  },
  (r) => {
    const province = pick(r, NO_SEPARATE_PST), amount = cents(r, 10, 8000), date = randDate(r, '2014-01-01', '2026-11-20')
    const name = GST.province_names[province]
    return { template_id: 'gst_hst.remove.tax.v1', target: 'tax', unit: 'CAD', inputs: { province, amount, mode: 'remove', date }, context: {},
      prompt: `A business in ${name} paid $${fmt(amount)} for a taxable purchase on ${longDate(date)}, and that amount includes GST/HST at the regular rate for ${name} on that date and no other tax. How much of the $${fmt(amount)} is GST/HST? Work out the pre-tax price rounded to the cent first, then subtract it from the total. ${ANSWER_LINE}` }
  },
]

// ---------------------------------------------------------------- mortgage templates
const FREQ_TEXT: Record<PaymentFrequency, string> = {
  'monthly': 'monthly payments (12 a year)',
  'semi-monthly': 'semi-monthly payments (24 a year)',
  'bi-weekly': 'bi-weekly payments (26 a year, not accelerated)',
  'weekly': 'weekly payments (52 a year, not accelerated)',
}
const COMP_TEXT: Record<Compounding, string> = { 'semi-annual': 'compounded semi-annually, not in advance', 'annual': 'compounded annually, not in advance' }
const rate = (r: R) => Math.round((2.5 + r() * 5) * 100) / 100
const principal = (r: R) => int(r, 120, 1400) * 500
const mortTemplates: ((r: R) => Built)[] = [
  (r) => {
    const P = principal(r), j = rate(r), y = pick(r, [15, 20, 25, 30]), comp: Compounding = r() < 0.2 ? 'annual' : 'semi-annual'
    return { template_id: 'mortgage_ca.payment.monthly.v1', target: 'payment', unit: 'CAD', context: {},
      inputs: { principal: P, annualRatePct: j, amortizationYears: y, paymentFrequency: 'monthly', compounding: comp },
      prompt: `A homebuyer in Canada takes out a fixed-rate mortgage for $${fmt0(P)} at ${j}% a year, ${COMP_TEXT[comp]}. The amortization period is ${y} years with monthly payments (12 a year). What is the regular payment, rounded to the cent? ${ANSWER_LINE}` }
  },
  (r) => {
    const P = principal(r), j = rate(r), y = pick(r, [20, 25, 30]), f = pick(r, ['semi-monthly', 'bi-weekly', 'weekly'] as PaymentFrequency[])
    return { template_id: 'mortgage_ca.payment.frequency.v1', target: 'payment', unit: 'CAD', context: {},
      inputs: { principal: P, annualRatePct: j, amortizationYears: y, paymentFrequency: f, compounding: 'semi-annual' },
      prompt: `A Canadian fixed-rate mortgage of $${fmt0(P)} has a rate of ${j}% a year, ${COMP_TEXT['semi-annual']}. It is amortized over ${y} years with ${FREQ_TEXT[f]}. What is each payment, rounded to the cent? ${ANSWER_LINE}` }
  },
  (r) => {
    const P = principal(r), j = rate(r), y = pick(r, [25, 30]), t = pick(r, [3, 5]), f = pick(r, ['monthly', 'bi-weekly'] as PaymentFrequency[])
    return { template_id: 'mortgage_ca.balance.term.v1', target: 'balance_after_term', unit: 'CAD', context: {},
      inputs: { principal: P, annualRatePct: j, amortizationYears: y, paymentFrequency: f, compounding: 'semi-annual', termYears: t },
      prompt: `A borrower signs a ${t}-year fixed-rate term on a $${fmt0(P)} mortgage at ${j}% a year, ${COMP_TEXT['semi-annual']}, amortized over ${y} years with ${FREQ_TEXT[f]}. The lender charges the regular payment rounded to the cent, and the borrower makes no prepayments and misses none. How much principal is still owed right after the last payment of the ${t}-year term? Round to the cent. ${ANSWER_LINE}` }
  },
  (r) => {
    const j = rate(r), comp: Compounding = 'semi-annual'
    return { template_id: 'mortgage_ca.ear.v1', target: 'effective_annual_rate_pct', unit: 'percent', context: {},
      inputs: { principal: 100000, annualRatePct: j, amortizationYears: 25, paymentFrequency: 'monthly', compounding: comp },
      prompt: `A Canadian lender quotes a fixed mortgage rate of ${j}% a year, ${COMP_TEXT[comp]}. What is the equivalent effective annual rate, in percent, to 4 decimal places? ${ANSWER_LINE}` }
  },
]

// ---------------------------------------------------------------- income tax templates
const SCOPE = 'Use the 2026 federal and Ontario tax brackets and rates, applying each rate to its own bracket, and round each line to the cent. Include the Ontario surtax, the Ontario Health Premium and the Ontario tax reduction (basic amount only, no dependants). Leave out the Ontario LIFT credit and any refundable credits.'
const SCOPE_ON = 'Use the 2026 Ontario tax brackets and rates, applying each rate to its own bracket, and round each line to the cent. Include the Ontario surtax, the Ontario Health Premium and the Ontario tax reduction (basic amount only, no dependants). Leave out the Ontario LIFT credit and any refundable credits.'
const income = (r: R) => Math.round(Math.exp(Math.log(18000) + r() * (Math.log(320000) - Math.log(18000))) * 100) / 100
const taxTemplates: ((r: R) => Built)[] = [
  (r) => {
    const A = income(r), who = pick(r, NAMES)
    return { template_id: 'income_tax_on.total.bpa_only.v1', target: 'total_tax', unit: 'CAD', context: { tax_year: 2026 },
      inputs: { taxableIncome: A },
      prompt: `${who} lived in Ontario for all of 2026. Their taxable income for 2026 is $${fmt(A)}, and their net income is the same amount. They claim only the federal and Ontario basic personal amounts: no other credits, no deductions beyond what is already reflected in taxable income, and no dependants. What is their total 2026 federal plus Ontario income tax? ${SCOPE} ${ANSWER_LINE}` }
  },
  (r) => {
    const A = income(r), who = pick(r, NAMES)
    return { template_id: 'income_tax_on.federal.bpa_only.v1', target: 'federal_tax', unit: 'CAD', context: { tax_year: 2026 },
      inputs: { taxableIncome: A },
      prompt: `For the 2026 tax year, ${who}, an Ontario resident, has taxable income and net income of $${fmt(A)} each. The only non-refundable credit claimed is the federal basic personal amount. What is ${who}'s net federal income tax for 2026? Use the 2026 federal brackets and rates, applying each rate to its own bracket, take the basic personal amount credit at the lowest federal rate, and round each line to the cent. ${ANSWER_LINE}` }
  },
  (r) => {
    const A = income(r), who = pick(r, NAMES)
    return { template_id: 'income_tax_on.ontario.bpa_only.v1', target: 'ontario_tax', unit: 'CAD', context: { tax_year: 2026 },
      inputs: { taxableIncome: A },
      prompt: `${who} lived in Ontario all of 2026 with taxable income of $${fmt(A)}. The only Ontario non-refundable credit claimed is the Ontario basic personal amount, and there are no dependants. How much Ontario tax is payable for 2026, counting the Ontario Health Premium as part of it? ${SCOPE_ON} ${ANSWER_LINE}` }
  },
  (r) => {
    const A = Math.round((40000 + r() * 50000) * 100) / 100, who = pick(r, NAMES)
    const cpp = Math.round((1800 + r() * 1700) * 100) / 100, ei = Math.round((650 + r() * 470) * 100) / 100
    return { template_id: 'income_tax_on.total.with_payroll_credits.v1', target: 'total_tax', unit: 'CAD', context: { tax_year: 2026, cpp_base_credit_amount: cpp, ei_credit_amount: ei, canada_employment_amount: 1501 },
      inputs: { taxableIncome: A, extraFederalCreditAmounts: Math.round((cpp + ei + 1501) * 100) / 100, extraOntarioCreditAmounts: Math.round((cpp + ei) * 100) / 100 },
      prompt: `${who} is an employee who lived in Ontario for all of 2026, with taxable income and net income of $${fmt(A)}. On top of the basic personal amounts, ${who} claims these non-refundable credit amounts: $${fmt(cpp)} for base CPP contributions and $${fmt(ei)} for EI premiums (both federal and Ontario), and the $1,501.00 Canada employment amount (federal only). No other credits, deductions or dependants. What is the total 2026 federal plus Ontario income tax? ${SCOPE} ${ANSWER_LINE}` }
  },
  (r) => {
    const A = Math.round((185000 + r() * 70000) * 100) / 100, who = pick(r, NAMES)
    return { template_id: 'income_tax_on.federal.bpa_phaseout.v1', target: 'federal_tax', unit: 'CAD', context: { tax_year: 2026 },
      inputs: { taxableIncome: A },
      prompt: `${who}, an Ontario resident, has 2026 taxable income and net income of $${fmt(A)} each and claims only the federal basic personal amount. At this income the federal basic personal amount is partly phased out. What is ${who}'s net federal income tax for 2026? Use the 2026 federal brackets and rates, applying each rate to its own bracket, round the reduced basic personal amount to the cent, take the credit at the lowest federal rate, and round each line to the cent. ${ANSWER_LINE}` }
  },
]

// ---------------------------------------------------------------- build
const checkers = [
  { name: 'gst_hst', templates: gstTemplates, rules: GST, rulesId: GST.id ?? 'rule:gst_hst_rates@v1', toolsloft: ['src/tools/gst-calculator/logic.ts', 'src/tools/sales-tax-calculator/logic.ts'],
    compute: (t: Built) => (computeGstHst(t.inputs) as any)[t.target] },
  { name: 'mortgage_ca', templates: mortTemplates, rules: MORT, rulesId: 'rule:mortgage_ca@v1', toolsloft: ['src/tools/mortgage-calculator/logic.ts', 'src/lib/finance.ts'],
    compute: (t: Built) => (computeMortgage(t.inputs) as any)[t.target] },
  { name: 'income_tax_on', templates: taxTemplates, rules: TAX, rulesId: 'rule:income_tax_2026_fed_on@v1', toolsloft: ['src/tools/income-tax-calculator/logic.ts', 'src/lib/tax.ts'],
    compute: (t: Built) => (computeIncomeTax(t.inputs) as any)[t.target] },
]

const lines: string[] = []
let appended = 0
checkers.forEach((c, ci) => {
  for (let k = 0; k < PER; k++) {
    const seed = BASE_SEED + ci * 100000 + k
    const r = rng(seed)
    const tmpl = c.templates[k % c.templates.length]
    const b = tmpl(r)
    const raw = c.compute(b)
    const expected = b.unit === 'percent' ? Math.round(raw * 1e8) / 1e8 : raw
    const id = `task:${SET}:${c.name}:${String(k + 1).padStart(4, '0')}`
    const task = {
      id, checker: c.name, template_id: b.template_id, seed,
      prompt: b.prompt, inputs: b.inputs, target: b.target, expected, unit: b.unit,
      tolerance: (c.rules as any).grading_tolerance[b.target],
      ...b.context,
      citations: cite(c.rules), rules_id: c.rulesId, provenance_id: id,
    }
    if (/\u2014/.test(task.prompt)) throw new Error('em-dash in prompt')
    const line = JSON.stringify(task)
    lines.push(line)
    const res = process.env.DRY ? 'dry' : appendEntry({
      id, kind: 'task', path: OUT, sha256: sha256(line), created_at: torontoNow(),
      author: `${TEMPLATE_AUTHOR} (template ${b.template_id})`,
      source: [
        ...cite(c.rules).map((x: any) => ({ type: 'url', url: x.url, retrieved: x.retrieved })),
        { type: 'rules', id: c.rulesId },
        ...c.toolsloft.map((p) => ({ type: 'toolsloft', path: p, commit: '69133650d6d6bc1d68c77e13bbe530a9d7d779c8', note: 'calculator logic the checker was adapted from' })),
      ],
      generator: { type: 'deterministic_template', template_id: b.template_id, seed, prng: 'mulberry32', script: 'tasks/generate.ts', model: null },
      human_review: { status: 'pending', reviewer: null, reviewed_at: null },
      license: 'Original CalcGym work. Tax figures are public CRA data. No model output in the task text or answer.',
      source_boundary: 'public sources and original work only',
    })
    if (res === 'appended') appended++
  }
})
writeFileSync(join(ROOT, OUT), lines.join('\n') + '\n')
console.log(`wrote ${lines.length} tasks to ${OUT}; ${appended} new provenance entries`)
