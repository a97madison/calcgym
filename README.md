# CalcGym

CalcGym is a set of Canadian tax and personal-finance tasks with answer checkers that grade a
model's numeric answer to the cent. Each checker is a pure function adapted from a Toolsloft
calculator, rewritten for Canadian rules, with every rate and threshold tied to a public CRA,
FCAC or Justice Laws page. The tasks are meant to be sold as RL environments and eval sets.

Status: v0, local only. Nothing here has been published, pushed or shared.

## Checkers

| checker | what it answers | adapted from (Toolsloft @ 6913365) | rule file |
|---|---|---|---|
| `gst_hst` | GST/HST on a sale by province and date of supply, add or back out | `gst-calculator`, `sales-tax-calculator` | `rules/gst_hst_rates.json` |
| `mortgage_ca` | Payment, balance at end of term, effective annual rate for a mortgage compounded half-yearly or yearly, not in advance | `mortgage-calculator`, `lib/finance.ts` | `rules/mortgage_ca.json` |
| `income_tax_on` | 2026 federal and Ontario income tax: brackets, basic personal amounts (with the federal phase-out), extra credit amounts, Ontario surtax, Health Premium, tax reduction | `income-tax-calculator`, `tax-bracket-calculator`, `lib/tax.ts` | `rules/income_tax_2026_fed_on.json` |

Each checker exports a `compute...()` function with typed inputs and outputs and a
`grade(task, answer)` function. `grade` recomputes the expected value from the task inputs (it
never trusts the stored answer), parses exactly one number from the text after the last
`ANSWER:`, and applies the tolerance in the rule file. Replies that put two numbers on the
answer line fail.

GST/HST and income tax use exact integer-cent arithmetic (BigInt), so float error cannot flip
a half cent. Mortgage math uses doubles; the Python oracle uses 60-digit decimals.

## Verification

- `oracle/oracle.py`: an independent Python implementation of all three checkers. Its
  constants were transcribed separately from the same pages, and `tests/test_oracle.py`
  checks them against `rules/*.json`.
- `tests/fuzz.test.ts`: differential fuzz. `oracle/fuzz_gen.py` writes 6,000 seeded random
  cases per checker (18,000 total, including rate-change dates and bracket edges); the TS
  checkers must match the oracle on every output to the cent.
- `tests/checkers.test.ts`: fixed cases, including both CRA T4032-ON 2026 worked examples
  reproduced line by line.
- `tests/mutation_smoke.sh`: breaks one constant at a time (old Nova Scotia rate, 15% federal
  rate, 2025 BPA, and so on) and confirms the fuzz test fails each time.

Run everything with `bash verify.sh` (Node 23.6 or later for built-in TypeScript type
stripping, Python 3.10 or later; no packages to install).

## Tasks

`tasks/generate.ts` builds tasks from fixed templates and a seed (mulberry32 PRNG). No model is
called. `tasks/v0-sample.jsonl` has 10 tasks per checker. Each line has the prompt, structured
inputs, target field, expected answer, tolerance, citations and a provenance id.

## Provenance

`provenance/log.jsonl` is an append-only log with a SHA-256 for every rule table, checker,
oracle, test, generator and task. Schema, the source boundary and the generation rule are in
`provenance/README.md`. Quoted figures from each fetched page are in
`provenance/sources/SOURCES.md`.

Generation rule: sellable tasks come only from deterministic templates or open-weight models,
never from Anthropic or OpenAI outputs. Source boundary: public sources and original work only.

## Known limits (v0)

- Income tax excludes the Ontario LIFT credit, dependant amounts, the federal top-up credit,
  dividends and AMT. Prompts say so explicitly.
- GST/HST covers GST and HST only, not PST or QST, and assumes the supply is taxable at the
  regular rate.
- Mortgage covers fixed-rate, non-accelerated payments. Accelerated payments, prepayments and
  variable-rate contracts are not modeled.
- All checker code and templates were written by the CalcGym build agent and still need human
  review (`human_review.status` is `pending` on every entry).
