#!/usr/bin/env python3
"""Python-side checks:
1. The oracle reproduces the CRA T4032-ON 2026 worked examples to the cent.
2. The oracle's hand-transcribed constants equal the values in rules/*.json
   (two independent transcriptions of the same CRA pages must agree).
3. Every task in tasks/*.jsonl has an expected answer the oracle re-derives independently,
   and every task has a provenance entry with source, author and date.
Run: python3 tests/test_oracle.py
"""
import glob, json, os, sys, unittest

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, os.path.join(ROOT, "oracle"))
from oracle import income_tax, gst_hst, mortgage, CONSTANTS  # noqa: E402


def rules(name):
    with open(os.path.join(ROOT, "rules", name)) as f:
        return json.load(f)


class CraWorkedExamples(unittest.TestCase):
    def test_example_below_ympe(self):
        r = income_tax(62798.84, extra_fed=3173.04 + 1101.88 + 1501, extra_on=3173.04 + 1101.88, method="payroll")
        self.assertEqual((r["federal_tax"], r["ontario_tax"], r["total_tax"]), (5957.85, 3264.26, 9222.11))
        self.assertEqual((r["federal_credits"], r["ontario_credits"], r["ontario_basic_tax"]), (3111.91, 871.83, 2664.26))

    def test_example_above_ympe(self):
        r = income_tax(79872, extra_fed=3519.45 + 1123.07 + 1501, extra_on=3519.45 + 1123.07, method="payroll")
        self.assertEqual((r["federal_tax"], r["ontario_tax"], r["total_tax"]), (9406.39, 4957.90, 14364.29))

    def test_hand_cases(self):
        self.assertEqual(income_tax(16452)["total_tax"], 0.0)
        self.assertEqual(income_tax(150000)["ontario_tax"], 15170.40)
        self.assertEqual(gst_hst("NS", 100, "add", "2025-03-31")["tax"], 15.0)
        self.assertEqual(gst_hst("NS", 100, "add", "2025-04-01")["tax"], 14.0)
        self.assertEqual(gst_hst("ON", 0.5, "add", "2026-01-01")["tax"], 0.07)
        self.assertEqual(mortgage(120000, 0, 10, "monthly")["payment"], 1000.0)
        self.assertAlmostEqual(mortgage(1, 5, 25, "monthly")["effective_annual_rate_pct"], 5.0625, places=12)
        self.assertEqual(mortgage(255450, 5.5, 20, "monthly")["payment"], 1748.28)


class ConstantsMatchRules(unittest.TestCase):
    def test_gst_hst_table(self):
        R = rules("gst_hst_rates.json")
        self.assertEqual(sorted(R["hst_provinces"]), CONSTANTS["hst"])
        # expand the oracle's per-province history at each JSON period start and compare
        for p in R["periods"]:
            for prov, pct in p["rates_pct"].items():
                hist = CONSTANTS["gst_hst_history"][prov]
                want = [r for start, r in hist if start <= p["from"]][-1]
                self.assertEqual(pct, want, f"{prov} from {p['from']}")
                if p["to"]:
                    want_end = [r for start, r in hist if start <= p["to"]][-1]
                    self.assertEqual(pct, want_end, f"{prov} to {p['to']}")

    def test_income_tax_tables(self):
        R = rules("income_tax_2026_fed_on.json")
        self.assertEqual(R["tax_year"], 2026)
        for key, bands in (("federal", CONSTANTS["fed_bands"]), ("ontario", CONSTANTS["on_bands"])):
            js = R[key]["brackets"]
            self.assertEqual([b["rate"] for b in js], [r for _, r in bands])
            self.assertEqual([b["from"] for b in js[1:]], [u for u, _ in bands[:-1]])
        self.assertEqual(R["federal"]["payroll_constants_K"], CONSTANTS["fed_k"])
        self.assertEqual(R["ontario"]["payroll_constants_KP"], CONSTANTS["on_kp"])
        b = R["federal"]["bpa"]
        mx, mn, enh, st, en = CONSTANTS["fed_bpa"]
        self.assertEqual((b["max"], b["min"], b["max"] - b["min"], b["phase_out_start"], b["phase_out_end"]), (mx, mn, enh, st, en))
        self.assertEqual(R["ontario"]["bpa"], CONSTANTS["on_bpa"])
        self.assertEqual([s["over"] for s in R["ontario"]["surtax"]], CONSTANTS["on_surtax"])
        self.assertEqual(R["ontario"]["tax_reduction_basic_amount"], CONSTANTS["on_reduction"])
        self.assertEqual(R["federal"]["credit_rate"], R["federal"]["brackets"][0]["rate"])
        self.assertEqual(R["ontario"]["credit_rate"], R["ontario"]["brackets"][0]["rate"])

    def test_mortgage_tables(self):
        R = rules("mortgage_ca.json")
        self.assertEqual(R["compounding_periods_per_year"], CONSTANTS["compound"])
        self.assertEqual(R["payment_frequencies"], CONSTANTS["freq"])


class TasksAreReproducible(unittest.TestCase):
    def setUp(self):
        self.tasks = []
        for path in sorted(glob.glob(os.path.join(ROOT, "tasks", "*.jsonl"))):
            with open(path) as f:
                self.tasks += [json.loads(l) for l in f if l.strip()]
        with open(os.path.join(ROOT, "provenance", "log.jsonl")) as f:
            self.log = {e["id"]: e for e in (json.loads(l) for l in f if l.strip())}

    def oracle_value(self, t):
        i = t["inputs"]
        if t["checker"] == "gst_hst":
            return gst_hst(i["province"], i["amount"], i["mode"], i["date"])[t["target"]]
        if t["checker"] == "mortgage_ca":
            return mortgage(i["principal"], i["annualRatePct"], i["amortizationYears"], i["paymentFrequency"],
                            i.get("compounding", "semi-annual"), i.get("termYears"))[t["target"]]
        if t["checker"] == "income_tax_on":
            return income_tax(i["taxableIncome"], i.get("netIncome"), i.get("extraFederalCreditAmounts", 0),
                              i.get("extraOntarioCreditAmounts", 0),
                              "payroll" if i.get("method") == "payroll_constants" else "bracket")[t["target"]]
        raise AssertionError(t["checker"])

    def test_expected_matches_oracle(self):
        self.assertGreater(len(self.tasks), 0)
        for t in self.tasks:
            want = self.oracle_value(t)
            tol = 1e-7 if t["unit"] == "percent" else 0.001
            self.assertLessEqual(abs(want - t["expected"]), tol, t["id"])

    def test_every_task_has_provenance(self):
        for t in self.tasks:
            e = self.log.get(t["provenance_id"])
            self.assertIsNotNone(e, t["id"])
            for k in ("source", "author", "created_at", "generator", "human_review", "license"):
                self.assertIn(k, e, f"{t['id']} missing {k}")
            self.assertTrue(e["source"])
            self.assertIsNone(e["generator"]["model"])
            self.assertTrue(t["citations"], t["id"])

    def test_no_em_dash(self):
        for t in self.tasks:
            self.assertNotIn("\u2014", t["prompt"])


if __name__ == "__main__":
    unittest.main(verbosity=1)
