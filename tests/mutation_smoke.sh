#!/usr/bin/env bash
# Mutation smoke test: break one constant at a time in a scratch copy of rules/ and confirm
# the differential fuzz test catches it. A fuzz suite that passes on broken rules is useless.
set -uo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
caught=0; total=0
mutate() {  # $1 = description, $2 = python expression applied to dict r for file $3
  rm -rf "$TMP/rules"; cp -r rules "$TMP/rules"
  python3 - "$TMP/rules/$3" "$2" <<'PY'
import json, sys
p, expr = sys.argv[1], sys.argv[2]
r = json.load(open(p)); exec(expr); json.dump(r, open(p, "w"))
PY
  total=$((total+1))
  if CALCGYM_RULES_DIR="$TMP/rules" node --test tests/fuzz.test.ts >/dev/null 2>&1; then
    echo "  NOT CAUGHT: $1"
  else
    echo "  caught: $1"; caught=$((caught+1))
  fi
}
mutate "Nova Scotia HST left at 15% after 2025-04-01" 'r["periods"][3]["rates_pct"]["NS"]=15' gst_hst_rates.json
mutate "PEI rate wrong in Jul-Sep 2016 (15 instead of 14)" 'r["periods"][1]["rates_pct"]["PE"]=15' gst_hst_rates.json
mutate "monthly compounding sneaks in (m=12)" 'r["compounding_periods_per_year"]["semi-annual"]=12' mortgage_ca.json
mutate "federal lowest rate 15% instead of 14%" 'r["federal"]["brackets"][0]["rate"]="0.15"' income_tax_2026_fed_on.json
mutate "federal BPA 16,129 (2025 value)" 'r["federal"]["bpa"]["max"]=16129' income_tax_2026_fed_on.json
mutate "Ontario BPA 12,747 (2025 value)" 'r["ontario"]["bpa"]=12747' income_tax_2026_fed_on.json
mutate "Ontario surtax threshold off by 108 (5,710)" 'r["ontario"]["surtax"][0]["over"]=5710' income_tax_2026_fed_on.json
mutate "Ontario 4th bracket rate 12.16 -> 12.06" 'r["ontario"]["brackets"][3]["rate"]="0.1206"' income_tax_2026_fed_on.json
mutate "OHP top cap 900 -> 750" 'r["ontario"]["health_premium"][4]["cap"]=750' income_tax_2026_fed_on.json
mutate "Ontario tax reduction 300 -> 294" 'r["ontario"]["tax_reduction_basic_amount"]=294' income_tax_2026_fed_on.json
echo "mutation smoke: $caught/$total mutations caught"
[ "$caught" -eq "$total" ]
