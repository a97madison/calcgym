#!/usr/bin/env bash
# Full CalcGym verification gate. Exits non-zero if any step fails.
#   1. fixed tests (TypeScript): CRA worked examples, hand cases, grader
#   2. generate fuzz cases with the independent Python oracle
#   3. differential fuzz: real TS checkers vs oracle, to the cent
#   4. mutation smoke: broken constants must be caught by the fuzz test
#   5. regenerate sample tasks (deterministic, must be byte-identical) and log provenance
#   6. Python tests: oracle vs CRA examples, JSON constants vs oracle constants, every task re-derived
#   7. house style: no em-dash anywhere in the repo
set -euo pipefail
cd "$(dirname "$0")"
echo "[1/7] fixed tests"
node --test tests/checkers.test.ts
echo "[2/7] fuzz cases from the Python oracle"
python3 oracle/fuzz_gen.py "${FUZZ_N:-6000}"
echo "[3/7] differential fuzz"
node --test tests/fuzz.test.ts
echo "[4/7] mutation smoke"
bash tests/mutation_smoke.sh
echo "[5/7] regenerate sample tasks"
before=$(sha256sum tasks/v0-sample.jsonl 2>/dev/null | cut -d' ' -f1 || true)
node tasks/generate.ts 10 tasks/v0-sample.jsonl
after=$(sha256sum tasks/v0-sample.jsonl | cut -d' ' -f1)
if [ -n "$before" ] && [ "$before" != "$after" ]; then echo "tasks/v0-sample.jsonl changed on regeneration"; exit 1; fi
echo "[6/7] Python oracle tests"
python3 tests/test_oracle.py
echo "[7/7] em-dash scan"
if grep -rIl $'\u2014' --exclude-dir=.git --exclude-dir=.cache --exclude-dir=vendor --exclude-dir=node_modules . ; then echo "em-dash found"; exit 1; fi
echo "VERIFY PASSED"
