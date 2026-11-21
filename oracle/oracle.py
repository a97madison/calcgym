#!/usr/bin/env python3
"""Independent CalcGym oracle.

Written separately from the TypeScript checkers in src/checkers/, in the same spirit as
Toolsloft's verify/oracle.py. It does NOT read rules/*.json for its arithmetic: every
constant below was transcribed a second time from the cited pages, so a typo in the JSON
shows up as a fuzz disagreement or a failed constants cross-check (tests/test_oracle.py).

Arithmetic: fractions.Fraction (exact) for GST/HST and income tax, decimal.Decimal with
60 significant digits for mortgages. Rounding is half up to the cent everywhere.
"""
from decimal import Decimal, ROUND_HALF_UP, getcontext
from fractions import Fraction as Fr
import math

getcontext().prec = 60
CENT = Fr(1, 100)


def r2(x):
    """Round a Fraction or Decimal to the cent, half up (away from zero for positives)."""
    if isinstance(x, Decimal):
        return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    x = Fr(x)
    sign = -1 if x < 0 else 1
    cents = math.floor(abs(x) * 100 + Fr(1, 2))
    return Fr(sign * cents, 100)


def fr(s):
    """Exact Fraction from a decimal string or int."""
    return Fr(str(s))


# ---------------------------------------------------------------- GST/HST
# CRA "GST/HST calculator (and rates)", table "GST/HST rates since April 1, 2013".
# Each province: list of (first day, rate %) in date order.
GST_HST_HISTORY = {
    "AB": [("2013-04-01", 5)],
    "BC": [("2013-04-01", 5)],
    "MB": [("2013-04-01", 5)],
    "NB": [("2013-04-01", 13), ("2016-07-01", 13), ("2016-10-01", 15)],
    "NL": [("2013-04-01", 13), ("2016-07-01", 15)],
    "NT": [("2013-04-01", 5)],
    "NS": [("2013-04-01", 15), ("2025-04-01", 14)],
    "NU": [("2013-04-01", 5)],
    "ON": [("2013-04-01", 13)],
    "QC": [("2013-04-01", 5)],
    "PE": [("2013-04-01", 14), ("2016-10-01", 15)],
    "SK": [("2013-04-01", 5)],
    "YT": [("2013-04-01", 5)],
}
HST = {"NB", "NL", "NS", "ON", "PE"}


def gst_hst_rate(prov, date):
    hist = GST_HST_HISTORY[prov]
    if date < hist[0][0]:
        raise ValueError("date before 2013-04-01")
    rate = None
    for start, pct in hist:
        if date >= start:
            rate = pct
    return rate


def gst_hst(prov, amount, mode, date):
    pct = gst_hst_rate(prov, date)
    amt = fr(amount)
    if mode == "add":
        base = amt
        tax = r2(amt * pct / 100)
        total = base + tax
    elif mode == "remove":
        total = amt
        base = r2(amt / (1 + Fr(pct, 100)))
        tax = total - base
    else:
        raise ValueError(mode)
    return {"taxType": "HST" if prov in HST else "GST", "ratePct": pct,
            "base": float(base), "tax": float(tax), "total": float(total)}


# ---------------------------------------------------------------- mortgage
# Interest Act s. 6: rate stated "calculated yearly or half-yearly, not in advance".
COMPOUND = {"semi-annual": 2, "annual": 1}
FREQ = {"monthly": 12, "semi-monthly": 24, "bi-weekly": 26, "weekly": 52}


def mortgage(principal, annual_rate_pct, years, freq, compounding="semi-annual", term_years=None):
    P = Decimal(str(principal))
    j = Decimal(str(annual_rate_pct)) / 100
    m = COMPOUND[compounding]
    k = FREQ[freq]
    n = years * k
    if j == 0:
        i = Decimal(0)
        raw = P / n
    else:
        # (1 + j/m)^(m/k) - 1 via exp/ln so the exponent can be fractional
        i = ((1 + j / m).ln() * Decimal(m) / Decimal(k)).exp() - 1
        raw = P * i / (1 - (1 + i) ** (-n))
    pay = r2(raw)
    bal = None
    bal_raw = None
    if term_years is not None:
        t = term_years * k
        if i == 0:
            b = P - pay * t
        else:
            g = (1 + i) ** t
            b = P * g - pay * (g - 1) / i
        bal_raw = max(Decimal(0), b)
        bal = float(r2(bal_raw))
    ear = ((1 + j / m) ** m - 1) * 100
    return {"payment": float(pay), "payment_raw": raw, "balance_raw": bal_raw, "total_interest_raw": raw * n - P,
            "total_interest": float(r2(raw * n - P)),
            "effective_annual_rate_pct": float(ear), "balance_after_term": bal, "numberOfPayments": n}


# ---------------------------------------------------------------- income tax 2026 (federal + Ontario)
# CRA "Current year tax rates and income brackets (2026)": (upper limit of band, rate).
FED_BANDS = [(58523, "0.14"), (117045, "0.205"), (181440, "0.26"), (258482, "0.29"), (None, "0.33")]
ON_BANDS = [(53891, "0.0505"), (107785, "0.0915"), (150000, "0.1116"), (220000, "0.1216"), (None, "0.1316")]
# T4032-ON Chart 1 / Chart 2 constants (payroll shortcut only)
FED_K = [0, 3804, 10241, 15685, 26024]
ON_KP = [0, 2210, 4376, 5876, 8076]
# CRA indexation page, 2026 column
FED_BPA_MAX, FED_BPA_MIN, FED_BPA_ENHANCED = 16452, 14829, 1623
FED_BPA_START, FED_BPA_END = 181440, 258482  # 29% and 33% bracket thresholds
FED_LOW = "0.14"
# T4032-ON 2026
ON_BPA = 12989
ON_LOW = "0.0505"
ON_SURTAX_1, ON_SURTAX_2 = 5818, 7446  # 20% over first, plus 36% over second
ON_REDUCTION_BASIC = 300


def band_tax(income, bands):
    tax, lower = Fr(0), Fr(0)
    for upper, rate in bands:
        if income <= lower:
            break
        top = income if upper is None else min(income, Fr(upper))
        tax += (top - lower) * fr(rate)
        if upper is None:
            break
        lower = Fr(upper)
    return r2(tax)


def payroll_tax(income, bands, consts):
    idx = 0
    lower = 0
    for n, (upper, _) in enumerate(bands):
        if income > lower:
            idx = n
        if upper is None:
            break
        lower = upper
    return r2(income * fr(bands[idx][1])) - consts[idx]


def fed_bpa(net):
    if net <= FED_BPA_START:
        return Fr(FED_BPA_MAX)
    if net >= FED_BPA_END:
        return Fr(FED_BPA_MIN)
    return r2(FED_BPA_MAX - (net - FED_BPA_START) * Fr(FED_BPA_ENHANCED, FED_BPA_END - FED_BPA_START))


def ohp(A):
    # Ontario Health Premium, T4032-ON 2026
    if A <= 20000:
        return Fr(0)
    if A <= 36000:
        return min(Fr(300), r2(Fr(6, 100) * (A - 20000)))
    if A <= 48000:
        return min(Fr(450), 300 + r2(Fr(6, 100) * (A - 36000)))
    if A <= 72000:
        return min(Fr(600), 450 + r2(Fr(25, 100) * (A - 48000)))
    if A <= 200000:
        return min(Fr(750), 600 + r2(Fr(25, 100) * (A - 72000)))
    return min(Fr(900), 750 + r2(Fr(25, 100) * (A - 200000)))


def income_tax(taxable, net=None, extra_fed=0, extra_on=0, method="bracket"):
    A = fr(taxable)
    NI = fr(net) if net is not None else A
    if method == "bracket":
        fb = band_tax(A, FED_BANDS)
        ob = band_tax(A, ON_BANDS)
    else:
        fb = payroll_tax(A, FED_BANDS, FED_K)
        ob = payroll_tax(A, ON_BANDS, ON_KP)
    fb, ob = max(Fr(0), fb), max(Fr(0), ob)
    bpa = fed_bpa(NI)
    fcred = r2((bpa + fr(extra_fed)) * fr(FED_LOW))
    fed = max(Fr(0), fb - fcred)
    ocred = r2((ON_BPA + fr(extra_on)) * fr(ON_LOW))
    t4 = max(Fr(0), ob - ocred)
    surtax = r2(Fr(20, 100) * max(Fr(0), t4 - ON_SURTAX_1) + Fr(36, 100) * max(Fr(0), t4 - ON_SURTAX_2))
    prem = ohp(A)
    red = t4 + surtax
    reduction = max(Fr(0), min(red, 2 * ON_REDUCTION_BASIC - red))
    on = t4 + surtax + prem - reduction
    f = float
    return {"federal_basic_tax": f(fb), "federal_bpa": f(bpa), "federal_credits": f(fcred), "federal_tax": f(fed),
            "ontario_basic_tax_on_income": f(ob), "ontario_credits": f(ocred), "ontario_basic_tax": f(t4),
            "ontario_surtax": f(surtax), "ontario_health_premium": f(prem), "ontario_tax_reduction": f(reduction),
            "ontario_tax": f(on), "total_tax": f(fed + on)}


# Exposed so tests can compare against rules/*.json (two independent transcriptions).
CONSTANTS = {
    "gst_hst_history": GST_HST_HISTORY, "hst": sorted(HST),
    "fed_bands": FED_BANDS, "on_bands": ON_BANDS, "fed_k": FED_K, "on_kp": ON_KP,
    "fed_bpa": [FED_BPA_MAX, FED_BPA_MIN, FED_BPA_ENHANCED, FED_BPA_START, FED_BPA_END],
    "on_bpa": ON_BPA, "on_surtax": [ON_SURTAX_1, ON_SURTAX_2], "on_reduction": ON_REDUCTION_BASIC,
    "compound": COMPOUND, "freq": FREQ,
}
