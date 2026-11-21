// Logs the non-task artifacts (rule tables, checkers, oracle, tests, generator, source notes).
// Safe to re-run: unchanged artifacts are skipped, changed ones fail until their id is bumped.
import { appendEntry, sha256File, torontoNow, AGENT_AUTHOR, TOOLSLOFT_COMMIT } from '../src/provenance.ts'
import { loadRules } from '../src/rules.ts'

const urls = (file: string) => loadRules<any>(file).citations.map((c: any) => ({ type: 'url', url: c.url, retrieved: c.retrieved }))
const tl = (...paths: string[]) => paths.map((path) => ({ type: 'toolsloft', path, commit: TOOLSLOFT_COMMIT }))
const base = {
  author: AGENT_AUTHOR,
  generator: { type: 'hand_written', model: null },
  human_review: { status: 'pending', reviewer: null, reviewed_at: null },
  source_boundary: 'public sources and original work only',
}
const CODE_LICENSE = 'Original CalcGym code. Toolsloft-derived parts come from Anthony M\'s own Toolsloft project; license for redistribution to be set by Anthony.'
const DATA_LICENSE = 'Facts from public Government of Canada pages (CRA, FCAC, Justice Laws). Government of Canada content is reproducible for non-commercial use under its terms; commercial use of the figures as facts is not restricted, but confirm before redistributing page text.'

const entries: Record<string, any>[] = [
  { id: 'source:sources_md@v1', kind: 'source_notes', path: 'provenance/sources/SOURCES.md', source: [...urls('gst_hst_rates.json'), ...urls('mortgage_ca.json'), ...urls('income_tax_2026_fed_on.json')], license: DATA_LICENSE },
  { id: 'rule:gst_hst_rates@v1', kind: 'rule_table', path: 'rules/gst_hst_rates.json', source: urls('gst_hst_rates.json'), license: DATA_LICENSE },
  { id: 'rule:mortgage_ca@v1', kind: 'rule_table', path: 'rules/mortgage_ca.json', source: urls('mortgage_ca.json'), license: DATA_LICENSE },
  { id: 'rule:income_tax_2026_fed_on@v1', kind: 'rule_table', path: 'rules/income_tax_2026_fed_on.json', source: urls('income_tax_2026_fed_on.json'), license: DATA_LICENSE,
    notes: 'Tax year 2026 (CRA has published 2026 values). Scope excludes LIFT, dependant reductions, top-up credit, dividends, AMT.' },
  { id: 'checker:gst_hst@v1', kind: 'checker', path: 'src/checkers/gst_hst.ts', source: [...tl('src/tools/gst-calculator/logic.ts', 'src/tools/sales-tax-calculator/logic.ts', 'src/lib/money.ts'), { type: 'rules', id: 'rule:gst_hst_rates@v1' }], license: CODE_LICENSE },
  { id: 'checker:mortgage_ca@v1', kind: 'checker', path: 'src/checkers/mortgage_ca.ts', source: [...tl('src/tools/mortgage-calculator/logic.ts', 'src/lib/finance.ts', 'src/lib/money.ts'), { type: 'rules', id: 'rule:mortgage_ca@v1' }], license: CODE_LICENSE },
  { id: 'checker:income_tax_on@v1', kind: 'checker', path: 'src/checkers/income_tax_on.ts', source: [...tl('src/tools/income-tax-calculator/logic.ts', 'src/tools/tax-bracket-calculator/logic.ts', 'src/lib/tax.ts'), { type: 'rules', id: 'rule:income_tax_2026_fed_on@v1' }], license: CODE_LICENSE },
  { id: 'checker:shared_money_grade@v1', kind: 'checker', path: 'src/money.ts', source: [...tl('src/lib/money.ts'), { type: 'original' }], license: CODE_LICENSE },
  { id: 'checker:shared_grade@v1', kind: 'checker', path: 'src/grade.ts', source: [{ type: 'original' }], license: CODE_LICENSE },
  { id: 'oracle:python@v1', kind: 'oracle', path: 'oracle/oracle.py', source: [...tl('verify/oracle.py'), ...urls('gst_hst_rates.json'), ...urls('mortgage_ca.json'), ...urls('income_tax_2026_fed_on.json')], license: CODE_LICENSE,
    notes: 'Written separately from src/checkers; constants transcribed a second time from the pages. Pattern (independent oracle) follows Toolsloft verify/oracle.py; no code copied.' },
  { id: 'oracle:fuzz_gen@v1', kind: 'oracle', path: 'oracle/fuzz_gen.py', source: [...tl('verify/fuzz_gen.py'), { type: 'original' }], license: CODE_LICENSE },
  { id: 'test:checkers@v1', kind: 'test', path: 'tests/checkers.test.ts', source: urls('income_tax_2026_fed_on.json'), license: CODE_LICENSE, notes: 'Includes the two CRA T4032-ON 2026 worked examples.' },
  { id: 'test:fuzz@v1', kind: 'test', path: 'tests/fuzz.test.ts', source: [...tl('verify/fuzz.harness.ts'), { type: 'original' }], license: CODE_LICENSE },
  { id: 'test:oracle_py@v1', kind: 'test', path: 'tests/test_oracle.py', source: [{ type: 'original' }], license: CODE_LICENSE },
  { id: 'checker:shared_rules_loader@v1', kind: 'checker', path: 'src/rules.ts', source: [{ type: 'original' }], license: CODE_LICENSE },
  { id: 'generator:provenance_lib@v1', kind: 'generator', path: 'src/provenance.ts', source: [{ type: 'original' }], license: CODE_LICENSE },
  { id: 'test:mutation_smoke@v1', kind: 'test', path: 'tests/mutation_smoke.sh', source: [{ type: 'original' }], license: CODE_LICENSE },
  { id: 'test:verify_gate@v1', kind: 'test', path: 'verify.sh', source: [...tl('verify/run.sh'), { type: 'original' }], license: CODE_LICENSE },
  { id: 'generator:tasks@v1', kind: 'generator', path: 'tasks/generate.ts', source: [{ type: 'original' }], license: CODE_LICENSE, notes: 'Deterministic templates, mulberry32 PRNG, no model calls.' },
]
for (const e of entries) {
  const res = appendEntry({ ...base, ...e, sha256: sha256File(e.path), created_at: torontoNow() })
  console.log(`${res.padEnd(9)} ${e.id}`)
}
