# DSCA Database — Architecture

## Strategic Context

This database is the **data asset layer** from the Seagull Health rethink document. The core insight: every DSCA produced for a client should also write structured rows into a standing database. Over time, that database becomes a risk map of the SNF universe — queryable, cross-comparable, and valuable independent of any single client engagement.

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
│  SYNTHESIS LAYER (crisp-dsca, on client engagement)         │
│  Pull existing row → Zotero + PubMed + Claude synthesis      │
│  Populates evidence and exposure_estimate tables             │
│  Produces charged DSCA work product                         │
└─────────────────────────────────────────────────────────────┘
```

The credit bureau analogy: the bureau maintains cheap structured data on everyone; the expensive full report pulls on demand.

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

Threshold: ≥2 citations = Recognized · 1 citation = Potential · 0 = Not Identified

C-4 combines F-740 + F-741 citation counts before applying the threshold.

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

### Exposure level

Computed from the condition set after classification:
- **High:** ≥2 Recognized conditions with High recognition risk
- **Moderate-High:** 1 Recognized High OR ≥3 active High risk conditions
- **Moderate:** ≥1 active High risk condition
- **Low:** no High risk conditions active

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

### Query categories (34 total)

| Category | Queries | Notes |
|---|---|---|
| Geographic | 6 | Cities ranked by exposure, city staffing comparison, DSS domain by city, urban vs rural exposure, facilities by city, state comparison |
| City Overview | 4 | Exposure distribution, full list, staffing by exposure, Five-Star by exposure |
| Facility Targeting | 7 | High exposure, priority list, clean facilities, staffing+risk intersection, special focus, below benchmark, high turnover |
| Condition Analysis | 8 | Full breakdown all conditions, all domains (not just 3+4), domain×classification matrix, Domain 2 F-689 specific, Domain 3+4 all active (Recognized and Potential), Recognized any domain, F-tag totals, F-658/F-740 co-occurrence, high-risk count |
| Ownership Patterns | 3 | Exposure by ownership, staffing by ownership, ownership×DSS domain combined |
| Staffing Integrity | 3 | Reported vs PBJ discrepancy, over-reporters with F-658, all staffing fields |
| Data Gaps | 1 | Gap inventory |
| Single Facility | 3 | Profile, condition breakdown, data gaps |

**Condition Analysis restructure (from original design):**
- Domain distribution now covers all 4 DSS domains, not just 3 and 4
- "All conditions × domain × classification" — full matrix breakdown across every domain
- "Domain 2 — Fall-Seizure Nexus" — F-689 specific; Domain 2 was previously invisible in the library
- "Domain 3+4 — all active" — includes Potential conditions, not Recognized-only
- "Recognized conditions — any domain" — the full confirmed picture across all domains
- "Clean facilities" — facilities with zero Recognized conditions; the low-risk end of the spectrum
- "Staffing gap + High-risk combined" — the intersection: below-benchmark staffing co-occurring with active High-risk conditions
- "Ownership × DSS domain + staffing" — multi-dimensional: ownership structure, average staffing, and domain-level condition counts in one query

### Drill-down

Queries marked with an orange dot in the sidebar support drill-down. Run the query, then click any row — a panel slides up from the bottom showing the underlying data. Examples: Domain distribution → click Domain 2 → see which facilities and conditions make up that count. Exposure distribution → click High → see those facilities. Condition breakdown → click C-4 → see which facilities carry it.

Drill-down SQL lives server-side only — not exposed to the client. Drillable queries: exposure_distribution, avg_staffing_by_exposure, condition_breakdown, domain_distribution, recognized_high_any_domain, ftag_citation_totals, ownership_exposure, cities_by_exposure, city_staffing_comparison, urban_rural_exposure.

### Pin / compare

After running any query, a "📌 Pin" button appears. Pinning freezes the current result in a left panel while a second query runs in the right panel — side-by-side comparison. One pinned result at a time. Use case: pin ownership exposure, run staffing by ownership alongside it.

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

Missouri exposure summary: 28 High · 221 Moderate-High · 226 Moderate · 12 Low. 289 urban / 198 rural. 242 distinct cities.

Data completeness: 22 conditions are Not Assessed (6 C-5 missing Five-Star ratings, 16 C-6 missing all staffing figures) — the data to evaluate them was absent, distinct from assessed-clean. Exposure levels are unaffected (Not Assessed is never an active finding).

---

## Migration Path

Current: SQLite file at `dsca.db` on local machine. Single user, no web access needed.

When web access is required (dashboard, client-facing queries, API):
- **Turso** (libSQL / hosted SQLite) — same schema, same queries, connection string change only. No migration needed.
- **Supabase/PostgreSQL** — requires schema migration; more powerful for concurrent access at scale.

Recommendation: stay local through the Missouri state run. Evaluate Turso when a web interface or second user is needed.
