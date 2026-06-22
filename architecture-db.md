# DSCA Database — Architecture

## Strategic Context

This database is the **data asset layer** from the Seagull Health rethink document (`~/crisp-app/reference/Complete rethink.txt`). The core insight: every DSCA produced for a client should also write structured rows into a standing database. Over time, that database becomes a risk map of the SNF universe — queryable, cross-comparable, and valuable independent of any single client engagement.

**Lineage:** dsca-db is a pared-down version of the crisp-dsca report. `~/crisp-dsca` (internally "CRISP SCI", ports 3006/3007) generates one-off DSCA reports using CRISP — form input, manual intervention, full pipeline (CMS + Zotero + PubMed + Claude) per run, results never persisted to a backend. dsca-db extracts the deterministic subset of that report and persists it: a row per facility instead of a PDF per request. It was built to be the foundation onto which the AI synthesis and Zotero integration are layered to generate reports — future reports build on top of dsca-db rows, not by wiring two standalone apps together. (`~/crisp-sci` is an empty leftover folder; crisp-app's CLAUDE.md still stale-points to it.)

The proprietary value is not the raw CMS data (anyone can pull that) but the **transformation**: reclassifying regulatory deficiencies through the DSS Framework neurological lens and crossing them with staffing data. That derived variable — DSS domain, recognition risk, certainty tier — doesn't exist in any public dataset.

---

## Two-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  DETERMINISTIC LAYER (this project)                         │
│  CMS public data → DSS classification → dsca.db rows        │
│  No AI. No cost per facility. Runs across all SNFs.         │
└────────────────────────┬────────────────────────────────────┘
                         │ facility row already exists
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  SYNTHESIS LAYER (future build, on client engagement)       │
│  Pull existing row → Zotero + PubMed + Claude synthesis      │
│  Populates evidence and exposure_estimate tables             │
│  Produces charged DSCA work product                         │
└─────────────────────────────────────────────────────────────┘
```

The credit bureau analogy: the bureau maintains cheap structured data on everyone; the expensive full report pulls on demand.

**Consumption is live (2026-06-10); write-back is not.** Three products now read this database directly:

| Consumer | Integration | What it reads |
|---|---|---|
| `~/crisp-dsca` (DSCA report) | `server/services/dsca-db.js` → `COMPUTED FACILITY RECORD [DSCA-DB]` prompt block; live CMS fallback for unloaded states | Classifications, exposure screen, citation detail, state percentiles |
| `~/crisp-dsca` → ROI bridge | `buildROIParams()` auto-sets ROI tool URL params | `licensed_beds`, survey tier (penalty/cited from citations + C-7) |
| `~/crisp-app` (litigation) | `server/services/dsca-db.js` → `DEFENDANT FACILITY PUBLIC RECORD` block with **period-of-care citation matching** (`ccn`/`careFrom`/`careTo` params) | Citations partitioned during/before/after the case window |

Both consumer projects carry the computed-facts contract in their prompts: values are restated, never derived. Running a new state (`node run-state.js <STATE>`) upgrades all three surfaces at once.

The **write-back** half of the synthesis layer (populating `evidence` / `exposure_estimate` at engagement time) remains unbuilt — gated on privacy-policy consent language (see Website constraint note in the project memory and `~/crisp-app/reference/sh-website-html/privacy-policy.html`).

---

## Schema Design Principles

### Global-first spine

The schema backbone is the DSS Framework, not CMS field names. Every condition row carries `dss_domain`, `recognition_risk`, and `classification` — DSS concepts that apply anywhere in the world. A UK facility with a CQC finding produces the same condition row structure as a US SNF with an F-tag. The F-tag is a value in `source_citation_value`, not a column name.

**The global test:** to add Japan, write `'LTCI finding'` as `source_citation_type` and the Japanese citation as `source_citation_value`. Same table, no new columns.

### CMS fields are nullable snapshots

Assessment-level CMS fields (`overall_rating`, `staffing_hprd`, etc.) are nullable. A non-US facility leaves them empty. They're stored on the assessment (not a separate table) because they're a snapshot of a single regulatory regime at a point in time.

### Conditions are rows, not columns

Each of the 7 standard SNF conditions is a separate row in the `condition` table. This allows cross-facility queries like "every facility with a Recognized Domain 4 condition" without pivoting or special-casing.

---

## CMS Data Sources

All from the CMS Provider Data Catalog (data.cms.gov) — free, no API key required.

| Dataset ID | Contents | Used for |
|---|---|---|
| `4pq5-n9py` | Provider Information | Facility list, Five-Star, staffing, ownership, enforcement |
| `r5ix-sfxw` | Health Deficiencies | F-tag citation counts per facility |
| `g6vv-u9sr` | Penalties | Civil monetary penalty counts |

**Data time window (verified against the API, 2026-06-09):** the Health Deficiencies dataset retains **each facility's three most recent inspection cycles** (`inspection_cycle` field = 1/2/3; MO rows 5,728/6,310/5,380). In calendar terms that spans **2019-01-15 through 2026-03-31**: COVID-era survey suspensions (March 2020) and the multi-year backlog mean a delayed facility's third cycle reaches back to 2019, while a recently surveyed facility's three cycles span ~2023–2026. MO citations by year: 2019: 1,013 · 2020: 633 · 2021: 985 · 2022: 2,017 · 2023: 3,674 · 2024: 4,853 · 2025: 3,746 · 2026: 497 — the 2020–21 dip and 2022–24 surge are the COVID suspension and catch-up. Citation counts aggregate the full retained window without date weighting. Provider Information is a current monthly snapshot; turnover is a trailing 12-month measure. Cross-check: 1,759 MO rows across the five screened F-tags matches the database's stored citation totals (807+639+219+94) to the row.

**Per-citation detail (added 2026-06-09):** the `citation` table stores one row per source citation — `citation_date`, `severity_code` (CMS scope/severity letter A–L), `survey_type`, `inspection_cycle` — backing the aggregated counts in `condition`. The pipeline now fetches deficiency detail rows per facility (one query for all tags, replacing five count queries; counts are derived from the rows, so they cannot disagree). Missouri was backfilled via a state-level sweep, reconciled per-assessment against stored counts (exact match) before writing. MO severity distribution: D: 893 · E: 636 · G: 126 · J: 84 · F: 10 · K: 8 · H: 2 — J/K are Immediate Jeopardy-level (92 citations). This enables recency weighting, severity-weighted classification, and per-facility survey-gap analysis as future classifier enhancements.

### Key field decisions

**City field:** `citytown` (not `provider_city` — confirmed from live API response).

**Staffing — two fields collected per assessment:**

| DB column | CMS field | Type |
|---|---|---|
| `staffing_hprd` | `reported_total_nurse_staffing_hours_per_resident_per_day` | Self-reported |
| `staffing_hprd_pbj` | `total_number_of_nurse_staff_hours_per_resident_per_day_on_t_4a14` | Payroll-based (PBJ), independently verified |
| `rn_hprd` | `reported_rn_staffing_hours_per_resident_per_day` | Self-reported (no PBJ equivalent published for RN) |

The gap between `staffing_hprd` and `staffing_hprd_pbj` is itself an analytical signal — facilities that over-report staffing relative to payroll may have documentation integrity problems co-occurring with other deficiency patterns (testable against F-658). Kansas City run confirmed several facilities over-reporting by 10–20%.

---

## Classification Rules (SNF)

### Classification vocabulary

Four states, not three. The distinction between the last two is deliberate:

- **Recognized** — finding confirmed at the threshold.
- **Potential** — finding present below the confirmation threshold.
- **Not Identified** — assessed against the data and found clean.
- **Not Assessed** — the CMS data required to evaluate the condition was missing.

"Not Identified" and "Not Assessed" are different claims. For a risk product, "we checked and it's clean" must not be conflated with "we couldn't check." Only Recognized and Potential are *active* findings; Not Assessed contributes nothing to exposure (the same as Not Identified) but is queryable as a distinct data-completeness signal. Currently only C-5 and C-6 can be Not Assessed (the F-tag and enforcement datasets return counts, defaulting to 0 = assessed-clean).

### F-tag conditions (C-1 to C-4)

**Severity-weighted scoring (decided 2026-06-09).** Each citation is weighted by its CMS scope/severity letter, then the weighted score is thresholded:

| Severity | Meaning | Weight |
|---|---|---|
| A–F | No actual harm | ×1 |
| G–I | Actual harm | ×2 |
| J–L | Immediate jeopardy | ×3 |

Threshold: weighted score ≥2.0 = Recognized · >0 = Potential · 0 = Not Identified. With all weights at 1.0 this reduces exactly to the original "≥2 citations / 1 citation" rule — the weighting is a strict generalization. Consequence: a single actual-harm or immediate-jeopardy citation classifies Recognized on its own, mirroring how CMS treats IJ as categorical rather than cumulative. Missouri impact when adopted: 28 condition upgrades, 2 facilities moved exposure tier (model-predicted and verified).

C-4 combines F-740 + F-741 weighted scores before applying the threshold. `source_count` continues to store the raw citation count; classification comes from the weighted score.

**Recency weighting — modeled and deliberately rejected.** Both calendar-based decay (≤24mo ×1.0 / ≤48mo ×0.5 / older ×0.25) and inspection-cycle-based decay were modeled: they move 83 and 102 facilities respectively and collapse High from 28-29 to 4. Rejected because (1) calendar decay punishes facilities the COVID survey backlog skipped, while cycle decay punishes frequently-surveyed facilities — opposite distortions, no neutral choice; (2) the decay constants are tunable knobs that would make the published distribution contestable; (3) a recognition-capacity pattern does not expire on a schedule — per-facility recency judgment belongs in the synthesis layer. Instead, recency is exposed as data: the Citation Detail query category surfaces latest-citation dates, cycle-1 counts, and stale Recognized conditions (107 in Missouri rest on citations >24 months old).

### Five-Star discrepancy (C-5)

`diff = overall_rating − health_inspection_rating`
- diff ≥ 2 → Recognized
- diff = 1 → Potential
- diff ≤ 0 → Not Identified
- overall or health rating missing → Not Assessed

### Staffing (C-6)

Never Recognized — staffing is continuous data, not a citation count.
- below benchmark → Potential. Triggers: `staffing_hprd < 3.8` OR `rn_hprd < 0.75` OR `nursing_turnover_pct > 50`
- at/above benchmark (any figure present) → Not Identified
- all three figures missing → Not Assessed (partial data still permits assessment)

Benchmarks: 3.8 total HPRD (national), 0.75 RN HPRD (national), 50% turnover (national avg).

### Enforcement (C-7)

- Recognized: Special Focus designation OR abuse flag
- Potential: penalty count > 0
- Not Identified: none of the above

### Domain 1 — scope boundary

Domain 1 (overt convulsive seizures) is structurally present in the schema but cannot be populated by the deterministic layer. The CMS F-tags queried (F-689, F-755, F-658, F-740/741) are deficiency signals — documentation failures, competency gaps, pharmacy errors. A facility that correctly documents and responds to a convulsive seizure produces no relevant deficiency citation. Domain 1 events are therefore invisible to CMS-based classification.

Two reasons this is not a gap in the logic — it is an honest scope boundary:

1. **Detection requires clinical records.** Domain 1 findings can only emerge from nursing notes, incident reports, and physician orders — the records flagged as missing in Data Gap DG-2. The deterministic layer cannot read deficiency statement text; it counts citations. Domain 1 classification belongs in the synthesis layer when clinical records are reviewed for a live engagement.

2. **Clinical scope.** Not all convulsive seizures in a dementia population are within the DSS Framework's scope. A resident with a longstanding epilepsy diagnosis predating dementia is a different clinical scenario than one whose seizure activity is driven by Alzheimer's pathology. The DSS Framework characterizes the dementia-seizure relationship specifically. A tonic-clonic seizure in a resident with diagnosed epilepsy may fall outside that scope regardless of whether it is documented.

Domain 1 will not appear in database rows from the deterministic pipeline. It should not be expected to. The absence of Domain 1 findings in the database is not an analytical gap — it is a correct reflection of what CMS public data can and cannot establish.

### Domain weighting — why 3/4 carry High risk and Domain 2 carries Moderate

This is a recurring question, so the rationale is recorded here permanently.

**Recognition risk is a misattribution-likelihood tier, not a clinical-importance ranking.** Per the DSS Framework (see `dss-framework.html` on the Seagull site): Domain 3 (Awareness Changes) is the *most frequently missed* presentation and Domain 4 (Behavioral Changes) the *most commonly misattributed* — these two carry the company's core thesis, that silent seizures get documented as behavioral symptoms. The conditions signaling a facility's capacity to catch those subtle presentations (C-2 pharmacy, C-3 professional standards, C-4 behavioral health/competency, C-6 staffing) are therefore tiered High. Domain 2 (Movement Changes) is *partially recognized* — its signals (seizure-precipitated falls, automatisms) are visible events more likely to enter the record in some form, so C-1 and C-5 are tiered Moderate.

**Domain 2 is not minor — the data says the opposite.** C-1 (Fall-Seizure Nexus, F-689) is the single most prevalent Recognized condition in the Missouri data: 225 of 487 facilities (46%) Recognized, another 143 Potential. Falls are long-term care's most common adverse event, and F-689 is among the most-cited F-tags nationally. Domain 2 is the highest-volume signal in the database.

**Floor rule (decided 2026-06-09):** no facility with a Recognized condition in any domain ranks Low. The upper tiers (High / Moderate-High) remain reserved for High-risk Domain 3/4 findings — the misattribution-capacity thesis — but a Recognized finding in any domain (or enforcement) lifts the floor to Moderate. Rationale: "Recognized fall-seizure citation pattern + Low exposure" is indefensible in client delivery, publication, or deposition. Alternatives modeled before deciding: counting Recognized Domain 2 toward the Moderate-High threshold moved 47 facilities and pushed Moderate-High to 54% of all Missouri SNFs, flattening the scale's discriminating power — rejected. The floor rule moved exactly 3 facilities (Low → Moderate). Stored Missouri assessments were re-scored from their existing condition rows; no CMS re-pull was needed.

**Query layer:** Domain 2 was invisible in the original query library — only Domain 3/4 queries existed. The Condition Analysis restructure fixed this (see Query Runner section): domain distribution now covers all four domains, and a dedicated "Domain 2 — Fall-Seizure Nexus" query exists. When adding queries, do not default to `dss_domain IN (3,4)` — ask whether Domain 2 belongs in the question.

### Exposure level

Computed from the condition set after classification:
- **High:** ≥2 Recognized conditions with High recognition risk
- **Moderate-High:** 1 Recognized High OR ≥3 active High risk conditions
- **Moderate:** ≥1 active High risk condition, OR any Recognized condition in any domain (floor rule)
- **Low:** no High risk conditions active and no Recognized condition anywhere

The upper tiers are driven by High-risk (Domain 3/4) conditions; the floor rule guarantees a Recognized condition in any domain ranks at least Moderate — see "Domain weighting" above for the full rationale.

---

## Standard Data Gaps (DG-1 to DG-5)

Written for every SNF assessment regardless of condition findings:

| Code | Record | Materiality | Availability |
|---|---|---|---|
| DG-1 | Pharmacy Records | Recognized | Available if Requested |
| DG-2 | MDS Data and Clinical Records | Recognized | Available if Requested |
| DG-3 | Seizure Protocols and Staff Training | Recognized | Available if Requested |
| DG-4 | State Licensing and Ombudsman Records | Potential | Available Independently |
| DG-5 | Pending Enforcement and Litigation | Potential | Available if Requested |

---

## Pipeline Flow

```
node run-city.js "Kansas City" MO        # city run
node run-state.js MO                     # state run
         │
         ├─ listFacilitiesByCity(city, state)   — city
         │   OR listFacilitiesByState(state)    — state
         │    └─ CMS 4pq5-n9py, filter by citytown+state or state only
         │
         └─ for each facility (300ms delay between):
              ├─ getFacilityRawData(ccn)
              │    ├─ CMS r5ix-sfxw — F-tag counts (F-689/755/658/740/741) [parallel]
              │    └─ CMS g6vv-u9sr — penalty count [parallel]
              │
              ├─ classifyFacility(assessmentId, provider, tagCounts, penaltyCount)
              │    ├─ C-1 to C-7 classification
              │    ├─ exposure level
              │    └─ DG-1 to DG-5 standard gaps
              │
              └─ writeAssessment(...) — db/write.js, single SQLite transaction
                   ├─ INSERT/upsert facility row
                   ├─ INSERT assessment row (with both staffing fields)
                   ├─ INSERT 7 condition rows
                   └─ INSERT 5 data_gap rows
```

Re-runs skip any CCN already in the database. Delete `dsca.db` to start fresh.

**Missouri scale estimate:** 487 SNFs × ~7 sec/facility = ~57 minutes at current 300ms delay. After a run that writes new rows, `db/dump.sql` is regenerated automatically (see `db/dump.js`).

---

## Query Runner

Express server at port 3010. Query library in `queries/library.js`.

**Start:** `node query-server.js`

**Deployment:** Railway at `dss-index.seagullhealth.global` (custom domain via CNAME). `process.env.PORT || 3010`.

**City queries include state:** All city-level queries (`cities_by_exposure`, `city_domain_distribution`, `city_staffing_comparison`, `facilities_by_city`) now include `f.region AS state` in SELECT with `GROUP BY f.city, f.region` so same-name cities across states appear as separate rows.

### Query categories (41 total)

| Category | Queries | Purpose |
|---|---|---|
| Start Here | 3 | Exposure distribution, State comparison, Cities ranked by exposure |
| Find Facilities | 10 | High exposure, Priority target list, Clean facilities, Special focus/abuse, Below staffing benchmark, High turnover, Staffing+risk intersection, Full facility list, Facilities by city, Urban vs rural |
| DSS Domain Analysis | 10 | All 4 domains individually + combined Domains 3+4 + multidomain overlap + by city + Potential-to-Recognized ratio + full ×domain matrix |
| Condition Deep-Dive | 6 | Condition breakdown, Recognized conditions, F-tag totals, Potential-dominant conditions, High-risk count, Five-Star by exposure |
| Staffing & Ownership | 5 | Ownership exposure, Reported vs PBJ, Over-reporters with F-658, Avg staffing by exposure, Staffing by city |
| Single Facility | 3 | Assessment snapshot, Full condition profile, Data gaps |
| Citation Detail | 3 | Citation recency, Severe citations (G+), Survey currency |
| Data Gaps | 1 | Gap inventory |

### Drill-down

Queries with drill-down support let you click a result row to open a panel with underlying detail data. The "↓ Click a row" hint appears in results when drill-down is available. No sidebar indicator is used.

Drill-down SQL lives server-side only — not exposed to the client. Drillable queries: exposure_distribution, avg_staffing_by_exposure, condition_breakdown, dss_domain_activity_by_facility, recognized_high_any_domain, ftag_citation_totals, ownership_exposure, cities_by_exposure, city_staffing_comparison, urban_rural_exposure.

### Compare (side-by-side)

After running any query, a "📌 Compare" button appears. Clicking it freezes the current result in a left panel while a second query runs in the right panel — side-by-side comparison. One pinned result at a time. Use case: pin ownership exposure, run staffing by ownership alongside it.

---

## Assessment ID

Format: `DSCA-YYYYMM-STATE-CCN`
Example: `DSCA-202606-MO-265399`

Stable per facility per run month. Running the same city again in a later month produces new assessment IDs, enabling longitudinal comparison: same `facility_id`, different `assessment_id` values over time.

---

## Current Data

| Run | Date | Facilities | Notes |
|---|---|---|---|
| Missouri (MO) | 2026-06-09 | 487 SNFs | First state run; 0 errors; city + zip + urban + lat/long populated |

Missouri exposure summary: 29 High · 221 Moderate-High · 228 Moderate · 9 Low. 289 urban / 198 rural. 242 distinct cities. (3 facilities moved Low → Moderate under the floor rule; 2 moved up under severity weighting — both 2026-06-09.)

Data completeness: 22 conditions are Not Assessed (6 C-5 missing Five-Star ratings, 16 C-6 missing all staffing figures) — the data to evaluate them was absent, distinct from assessed-clean. Exposure levels are unaffected (Not Assessed is never an active finding).

---

## Deployment

Hosted on Railway at `dss-index.seagullhealth.global` (custom domain via DreamHost CNAME → `wjmbvw7j.up.railway.app`).
SQLite file at `dsca.db` deployed with the repo — same Node.js + Express stack as local development.

Future:
- **Turso** (libSQL / hosted SQLite) — same schema, same queries, connection string change only. No migration needed.
- **Supabase/PostgreSQL** — requires schema migration; more powerful for concurrent access at scale.
