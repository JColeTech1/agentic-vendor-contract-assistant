# Contract Register — Locked Schema (v1)

Derived strictly from the 24 evaluation questions (7 baseline + 17 round-2). Every
column is justified by a real question. Columns hold FACTS, not questions — the same
field answers many questions via different queries (e.g. annual_value answers "rank by
cost", "total spend", "largest commitment", and "savings").

This schema is the single source of truth for BOTH:
- the Content Understanding extraction analyzer (the fields it pulls), and
- the SharePoint list columns (where the table lives in the client tenant).

---

## Columns

| # | Column | Type | Notes | Justified by |
|---|---|---|---|---|
| 1 | vendor | text | provider/vendor name | identity (all questions) |
| 2 | source_contract | text | filename / contract ID the row came from | citations on every answer |
| 3 | client_name | text | as written on the contract (e.g. "Contoso Marketing, LLC" / "Inc.") | "same client company?" (entity resolution) |
| 4 | service_category | text/enum | project-mgmt, CRM, analytics, creative-design, stock-media, email/ESP, accounting-payroll, IT-managed, telecom, cloud-hosting, staffing, benefits, office-lease, equipment-lease, cleaning | redundancy / overlap questions |
| 5 | annual_value | number (nullable) | EXACT stated annual total, numeric only. NULL if no fixed annual fee. | rank by cost, total spend, largest, savings |
| 6 | annual_value_note | text (optional) | human-readable context when value is null/odd (e.g. "variable, engagement-based; ~$210k historical") | supports the null case without polluting the number |
| 7 | currency | text | ISO (USD) | pairs with annual_value |
| 8 | renewal_type | enum: auto / manual / none | how it renews | "manual vs auto-renew", "which require manual renewal" |
| 9 | renewal_date | date | next renewal/expiry date | "auto-renew in 90 days", "before Sept 1" |
| 10 | notice_days | number | required non-renewal notice period in days | longest/shortest notice period |
| 11 | escalation_type | enum: CPI / fixed% / usage / none | type of price increase on renewal | "price increase? break down by type" |
| 12 | escalation_pct | number (nullable) | the fixed-% value when escalation_type = fixed% | the fixed-% escalation questions |
| 13 | has_dpa | yes / no | carries a DPA / BAA / equivalent data-privacy obligation | "which carry a DPA obligation" |
| 14 | confidence_flag | enum: clear / review | extractor sets "review" on any field it could not cleanly resolve | human-in-the-loop trigger |

Total: 14 columns.

---

## Computed at query time (NOT stored)

- **notice_deadline** = renewal_date minus notice_days. Computed live so it can never
  drift / go stale. (Decision: compute, don't store.)
- **status (OPEN / URGENT / MISSED)** = compare notice_deadline to today:
  - MISSED if notice_deadline < today
  - URGENT if today <= notice_deadline <= today + 30 days
  - OPEN if notice_deadline > today + 30 days

---

## Two design rules that make this a real tool (not a black box)

1. **Numeric columns stay numeric.** annual_value is a number or NULL — never text.
   Putting "~$210k historical" as text would break SUM / ORDER BY / MAX across the
   whole column. This is exactly the bug that scrambled the ranking and total in the
   eval. Context goes in annual_value_note instead.

2. **The weird rows flag themselves.** The extractor sets confidence_flag = "review"
   whenever it can't cleanly resolve a field (variable fee, ambiguous date, missing
   value). The process is then simply: anything flagged "review" gets human eyes
   before it is trusted. We do NOT rely on remembering which contracts are odd — the
   system surfaces them. (Lumen would come out of extraction already flagged, because
   no single annual number exists.)

---

## Two-lane querying (why the table stays small)

- **Structured lane (this table):** anything countable / comparable / sortable — money,
  dates, categories, yes/no. Finite columns, infinite queries.
- **Full-text lane (RAG over contract text):** anything narrative / interpretive —
  "what does the indemnification clause say", "summarize termination terms". No
  columns needed; handled by the existing Foundry IQ retrieval over the contract text.

The agent routes each question to the right lane. The table grows only when a NEW FACT
must be captured — not when a new question is asked. Question count is infinite; column
count is small and slow-growing.

---

## Known extraction edge cases to expect (from the real 16 contracts)

- **Lumen Creative Staffing:** no fixed annual fee (hourly, variable). annual_value =
  NULL, note = "variable; ~$210k historical", flag = review.
- **Per-seat contracts (Tasklytic $54k, Cadence $28.8k):** state both a per-seat rate
  AND a stated annual total. Extract the STATED annual total, never compute seat x rate.
  Both share $360/seat — do not let that swap their totals.
- **Monthly-quoted contracts (Stratus $12k/mo, SecureHaven $13k/mo, Veritel $3k/mo,
  Meridian $1.5k/mo, PristineWorks $2.4k/mo, Harborline $32.5k/mo):** capture the
  ANNUAL figure (the contracts state both); do not store the monthly number in
  annual_value.
- **Office lease (Harborline):** counts as a contract and as a commitment for
  ranking/total. service_category = office-lease, renewal_type = manual.
