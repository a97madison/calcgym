#!/usr/bin/env python3
"""Generate random inputs plus INDEPENDENT oracle outputs for all three checkers.

tests/fuzz.test.ts then runs the real TypeScript checkers on the same inputs and requires
agreement. Modeled on Toolsloft verify/fuzz_gen.py. Seeded, so the case file is reproducible.
Usage: python3 oracle/fuzz_gen.py [cases_per_checker]  (default 6000)
"""
import json, os, random, sys
from decimal import Decimal
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from oracle import gst_hst, mortgage, income_tax, GST_HST_HISTORY, FREQ, COMPOUND

SEED = 20261120
N = int(sys.argv[1]) if len(sys.argv) > 1 else 6000
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".cache", "fuzz-cases.json")
rng = random.Random(SEED)


def money(lo, hi):
    """Random dollar amount with cents, log-uniform between lo and hi."""
    import math
    v = math.exp(rng.uniform(math.log(lo), math.log(hi)))
    return round(v, 2)


def half_cent_distance(x):
    """Distance (in dollars) from x to the nearest half-cent rounding boundary."""
    frac = (x * 100) % 1
    return abs(frac - Decimal("0.5")) / 100


# ---------- GST/HST
provs = sorted(GST_HST_HISTORY)
d0, d1 = date(2013, 4, 1), date(2026, 12, 31)
edge_dates = ["2013-04-01", "2016-06-30", "2016-07-01", "2016-09-30", "2016-10-01", "2025-03-31", "2025-04-01"]
gst = []
for n in range(N):
    prov = rng.choice(provs)
    if n % 10 == 0:
        dt = rng.choice(edge_dates)
    else:
        dt = (d0 + timedelta(days=rng.randrange((d1 - d0).days + 1))).isoformat()
    r = rng.random()
    amt = 0.0 if r < 0.005 else (round(rng.randrange(0, 1000) / 100, 2) if r < 0.2 else money(1, 1_000_000))
    mode = rng.choice(["add", "remove"])
    gst.append({"in": {"province": prov, "amount": amt, "mode": mode, "date": dt}, "out": gst_hst(prov, amt, mode, dt)})

# ---------- mortgage
mort = []
for n in range(N):
    P = money(10_000, 3_000_000)
    rate = 0.0 if n % 50 == 0 else round(rng.uniform(0.5, 12), rng.choice([2, 3]))
    yrs = rng.randint(1, 35)
    freq = rng.choice(sorted(FREQ))
    comp = rng.choice(sorted(COMPOUND)) if n % 4 == 0 else "semi-annual"
    term = rng.randint(1, yrs - 1) if yrs > 1 and rng.random() < 0.6 else None
    o = mortgage(P, rate, yrs, freq, comp, term)
    inp = {"principal": P, "annualRatePct": rate, "amortizationYears": yrs, "paymentFrequency": freq, "compounding": comp}
    if term is not None:
        inp["termYears"] = term
    out = {k: o[k] for k in ["payment", "total_interest", "effective_annual_rate_pct", "balance_after_term", "numberOfPayments"]}
    # how close each rounded field sat to a half-cent boundary (lets the harness flag float-ambiguous cases)
    out["boundary"] = {
        "payment": float(half_cent_distance(o["payment_raw"])),
        "total_interest": float(half_cent_distance(o["total_interest_raw"])),
        "balance_after_term": None if o["balance_raw"] is None else float(half_cent_distance(o["balance_raw"])),
    }
    mort.append({"in": inp, "out": out})

# ---------- income tax
thresholds = [53891, 58523, 107785, 117045, 150000, 181440, 220000, 258482, 20000, 36000, 48000, 72000, 200000]
itax = []
for n in range(N):
    if n % 5 == 0:
        A = round(rng.choice(thresholds) + rng.choice([-1, -0.01, 0, 0.01, 1, rng.uniform(-500, 500)]), 2)
    elif n % 7 == 0:
        A = round(rng.uniform(0, 40_000), 2)
    else:
        A = money(1_000, 2_000_000)
    A = max(0.0, A)
    if rng.random() < 0.3:
        net = round(A + rng.uniform(0, 60_000), 2)
    elif rng.random() < 0.2:
        net = round(rng.choice([181440, 258482]) + rng.uniform(-5000, 80000), 2)
    else:
        net = None
    ef = round(rng.uniform(0, 10_000), 2) if rng.random() < 0.5 else 0
    eo = round(rng.uniform(0, 10_000), 2) if rng.random() < 0.5 else 0
    method = "payroll_constants" if rng.random() < 0.2 else "bracket"
    inp = {"taxableIncome": A, "extraFederalCreditAmounts": ef, "extraOntarioCreditAmounts": eo, "method": method}
    if net is not None:
        inp["netIncome"] = max(net, 0.0)
    out = income_tax(A, inp.get("netIncome"), ef, eo, "payroll" if method == "payroll_constants" else "bracket")
    itax.append({"in": inp, "out": out})

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump({"seed": SEED, "per_checker": N, "gst_hst": gst, "mortgage_ca": mort, "income_tax_on": itax}, f)
print(f"wrote {OUT}: {len(gst)} gst_hst, {len(mort)} mortgage_ca, {len(itax)} income_tax_on cases (seed {SEED})")
