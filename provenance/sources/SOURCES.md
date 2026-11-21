# Sources fetched for CalcGym v0

All pages fetched on 2026-11-20 (America/Toronto) through a read-only web fetch. canada.ca
refused direct downloads from the build machine, so raw HTML snapshots are not stored here.
Instead each entry quotes the exact figures used, so a reviewer can re-open the URL and compare.
If a page changes after this date, the rule files must be re-verified and given a new version.

## S1. CRA, GST/HST calculator (and rates)
https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html

- "As of April 1, 2025, the HST rate has decreased to 14% in Nova Scotia."
- Table "GST/HST rates since April 1, 2013", columns On or after April 1, 2025 / October 1, 2016 to March 31, 2025 / July 1, 2016 to September 30, 2016 / April 1, 2013 to June 30, 2016:
  - AB, BC, MB, NT, NU, QC, SK, YT: 5% in every column
  - New Brunswick: 15 / 15 / 13 / 13
  - Newfoundland and Labrador: 15 / 15 / 15 / 13
  - Nova Scotia: 14 / 15 / 15 / 15
  - Ontario: 13 in every column
  - Prince Edward Island: 15 / 15 / 14 / 14
- "Results are estimates only. Due to rounding, calculated amounts may differ from final totals by a cent or two." (basis for the 1 cent grading tolerance)

## S2. CRA, Current year tax rates and income brackets (2026)
https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/current-year.html

- Federal 2026: $0 to $58,523 at 14%; $58,523.01 to $117,045 at 20.5%; $117,045.01 to $181,440 at 26%; $181,440.01 to $258,482 at 29%; over $258,482 at 33%.
- Ontario 2026: $0 to $53,891 at 5.05%; $53,891.01 to $107,785 at 9.15%; $107,785.01 to $150,000 at 11.16%; $150,000.01 to $220,000 at 12.16%; over $220,000 at 13.16%.

## S3. CRA, Indexation adjustment for personal income tax and benefit amounts
https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/adjustment-personal-income-tax-benefit-amounts.html

- 2026 column: indexation 2.0%; thresholds 58,523 / 117,045 / 181,440 / 258,482.
- Basic personal amount at or above the 33% threshold: $14,829. Maximum enhanced amount: $1,623. Maximum BPA (net income at or below the 29% threshold): $16,452.
- Footnote 1: the increase "gradually phases out" between the 29% and 33% thresholds.

## S4. CRA, T4032-ON Payroll Deductions Tables, Ontario, January 1, 2026 (T4032-ON(E) Rev. 26)
https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables/t4032on-jan/t4032on-january-general-information.html

- Chart 1 constants K: 0 / 3,804 / 10,241 / 15,685 / 26,024. Chart 2 constants KP: 0 / 2,210 / 4,376 / 5,876 / 8,076.
- "For 2026, the lowest federal tax bracket will be 14%."
- Federal BPA maximum 16,452, minimum 14,829.
- Ontario health premium for 2026: $0 up to $20,000; lesser of $300 and 6% over $20,000 (to $36,000); lesser of $450 and $300 + 6% over $36,000 (to $48,000); lesser of $600 and $450 + 25% over $48,000 (to $72,000); lesser of $750 and $600 + 25% over $72,000 (to $200,000); lesser of $900 and $750 + 25% over $200,000.
- Surtax: $0 up to basic provincial tax of $5,818; 20% of the amount over $5,818; plus 36% of the amount over $7,446.
- Tax reduction basic amount $300. "The reduction is equal to twice the individual's personal amounts minus the provincial tax payable before reduction."
- "For 2026, the Ontario non-refundable basic personal tax credit is $12,989."
- Worked example 1 (weekly $1,300, RRSP $80): annual taxable income $62,798.84; federal tax $9,069.76; federal credits on $22,227.92 = $3,111.91; federal tax payable $5,957.85; Ontario $3,536.09 minus credits $871.83 = $2,664.26; health premium $600; Ontario total $3,264.26; total $9,222.11.
- Worked example 2 (weekly $1,600, above YMPE): taxable income $79,872.00; federal payable $9,406.39; Ontario basic $4,207.90; health premium $750; Ontario total $4,957.90; total $14,364.29.

## S5. CRA, T4127 Payroll Deductions Formulas, 124th edition (effective January 1, 2027)
https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas/t4127-jan/t4127-jan-payroll-deductions-formulas-computer-programs.html

The current-edition URL now serves the 2027 edition (posted 2026-11-19). It was used for:
- The BPAF formula shape: full amount up to the 29% threshold, linear reduction to the minimum at the 33% threshold, "no rounding on this division", result rounded to the cent half up. 2026 amounts come from S3 and S4.
- Ontario formulas: V1 surtax on T4, S = lesser of (T4 + V1) and 2 x (basic amount + Y) - (T4 + V1).
- Table 8.22 "Rates, income thresholds and constants for 2026" and Table 8.23 "Other rates and amounts for 2026": federal K and ON KP match S4; ON basic amount 12,989; ON S2 300; V1 thresholds 5,818 (0.200) and 7,446 (0.360).

## S6. Interest Act, R.S.C. 1985, c. I-15, section 6 (Justice Laws, Act current to 2026-10-29)
https://laws-lois.justice.gc.ca/eng/acts/I-15/page-1.html

- s. 6: no interest is recoverable on a blended-payment mortgage "unless the mortgage or hypothec contains a statement showing the amount of the principal money and the rate of interest chargeable on that money, calculated yearly or half-yearly, not in advance."

## S7. FCAC, Credit agreement for a fixed interest loan for a fixed amount (Mortgage), information box example
https://www.canada.ca/en/financial-consumer-agency/services/industry/bulletins/information-box-examples/credit-agreement-fixed-mortgage.html

- "5.60% Fixed rate per year. This interest is compounded twice per year but charged monthly."
- Payment $4,565.87 on $619,000 over 20 years "includes ... when applicable, your monthly property tax portion". Our P&I at those terms is $4,270.54, so the box is not usable as a numeric test.
- Note: FCAC's companion personal-loan box ($10,000, 10.75% "compounded twice per year", 5 years, $216.18) matches monthly-compounding math ($216.18) rather than semi-annual ($215.02). FCAC samples are illustrative; CalcGym does not grade against them.
