// Differential fuzz: the real TypeScript checkers vs the independent Python oracle on the
// cases in .cache/fuzz-cases.json (written by oracle/fuzz_gen.py). Every money field must
// match to the cent. Run `python3 oracle/fuzz_gen.py` first (npm run fuzz does both).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeGstHst } from '../src/checkers/gst_hst.ts'
import { computeMortgage } from '../src/checkers/mortgage_ca.ts'
import { computeIncomeTax } from '../src/checkers/income_tax_on.ts'

const file = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'fuzz-cases.json')
const C = JSON.parse(readFileSync(file, 'utf8'))
const cents = (x: number) => Math.round(x * 100)

test(`gst_hst: ${C.gst_hst.length} fuzz cases agree to the cent`, () => {
  let n = 0
  for (const t of C.gst_hst) {
    const r = computeGstHst(t.in)
    for (const k of ['base', 'tax', 'total'] as const) {
      assert.equal(cents(r[k]), cents(t.out[k]), `${k} ${JSON.stringify(t.in)}`)
    }
    assert.equal(r.ratePct, t.out.ratePct)
    assert.equal(r.taxType, t.out.taxType)
    n++
  }
  console.log(`gst_hst fuzz: ${n}/${C.gst_hst.length} agree exactly`)
})

test(`mortgage_ca: ${C.mortgage_ca.length} fuzz cases agree to the cent`, () => {
  let exact = 0
  let boundary = 0
  for (const t of C.mortgage_ca) {
    const r = computeMortgage(t.in)
    assert.equal(r.numberOfPayments, t.out.numberOfPayments)
    const rel = Math.abs(r.effective_annual_rate_pct - t.out.effective_annual_rate_pct)
    assert.ok(rel < 1e-9, `EAR ${JSON.stringify(t.in)}`)
    let allExact = true
    for (const k of ['payment', 'total_interest', 'balance_after_term'] as const) {
      const a = r[k]
      const b = t.out[k]
      if (b === null) {
        assert.equal(a, null)
        continue
      }
      const d = Math.abs(cents(a as number) - cents(b))
      if (d === 0) continue
      // Only allowed when the true value sits within 1e-6 dollars of a half cent, where
      // double precision cannot decide the rounding. Counted and reported, never silent.
      assert.ok(d === 1 && t.out.boundary[k] !== null && t.out.boundary[k] < 1e-6, `${k} off by ${d} cents: ${JSON.stringify(t.in)} ts=${a} py=${b}`)
      allExact = false
    }
    allExact ? exact++ : boundary++
  }
  console.log(`mortgage_ca fuzz: ${exact} exact, ${boundary} half-cent-boundary ties, ${C.mortgage_ca.length} total`)
})

test(`income_tax_on: ${C.income_tax_on.length} fuzz cases agree to the cent on every line`, () => {
  let n = 0
  for (const t of C.income_tax_on) {
    const r = computeIncomeTax(t.in) as Record<string, number>
    for (const [k, v] of Object.entries(t.out)) {
      assert.equal(cents(r[k]), cents(v as number), `${k} ${JSON.stringify(t.in)} ts=${r[k]} py=${v}`)
    }
    n++
  }
  console.log(`income_tax_on fuzz: ${n}/${C.income_tax_on.length} agree exactly on all 12 output lines`)
})
