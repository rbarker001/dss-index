# CLAUDE-db.md — DSCA Database Project

## What This Is

A structured database for DSCA (Dementia-Seizure Conditions Assessment) data collection. Deterministic classification only — no AI analysis. Every SNF in a city or state gets a structured row populated from CMS public data, classified through the DSS Framework.

This is the **data asset layer** described in the Seagull Health strategic rethink (`~/crisp-app/reference/Complete rethink.txt`). The database is the product; reports are generated on demand from rows that already exist.

**Lineage:** dsca-db is a pared-down version of the crisp-dsca report. `~/crisp-dsca` (internally "CRISP SCI") generates one-off DSCA reports using CRISP — form input, manual intervention, results never persisted. dsca-db extracts the deterministic subset of that report and persists it, as the foundation onto which the AI synthesis and Zotero integration are layered to generate reports. crisp-dsca is the reference implementation for that future synthesis layer, not a system this database integrates with as-is.

---

## How to Work With This Project

- Proceed with all edits directly.
- Keep `architecture-db.md` current after any significant schema or pipeline change.
- The schema is global-first — CMS fields are values, not structure. Never add US-specific columns to the spine tables.
- The deterministic layer never calls Claude or Zotero. Those enter at engagement time only.

---

## Stack

| Layer | Tech |
|---|---|
| Database | SQLite via `better-sqlite3` |
| Runtime | Node.js 18+ |
| CMS data | CMS Provider Data Catalog (free, no API key) |
| Query runner | Express + static HTML at port 3010 |

---

## Start

```bash
# City run — writes structured rows to dsca.db
node run-city.js "Kansas City" MO

# State run — all SNFs in a state
node run-state.js MO

# Query runner — browser UI
node query-server.js
# Open http://localhost:3010
```

---

## Version Control & Backup

The repo is a local git repository. The binary `dsca.db` is **gitignored**; the data is version-controlled as a text dump at `db/dump.sql` instead — diffable, no binary churn.

- After any run that writes new rows, `run-city.js` / `run-state.js` regenerate `db/dump.sql` automatically (`db/dump.js`). Commit it alongside any code changes: `git add db/dump.sql && git commit`.
- Rebuild the database from the dump: `sqlite3 dsca.db < db/dump.sql`.
- Regenerate the dump manually if needed: `sqlite3 dsca.db .dump > db/dump.sql`.

Gitignored: `dsca.db`, `*.db-wal`, `*.db-shm`, `node_modules/`, `.env`, `.DS_Store`, `.claude/settings.local.json`.

Currently **local-only** — no remote configured. Add a private GitHub remote for offsite backup when ready (this is healthcare-adjacent risk data; keep the repo private).

---

## Key Files

| File | Purpose |
|---|---|
| `schema.sql` | 6-table SQLite schema — source of truth for all table definitions |
| `db/init.js` | Opens `dsca.db`, runs `schema.sql`, returns db connection |
| `db/write.js` | Shared write layer — `createWriter(db)` prepares statements and returns `writeAssessment` (facility upsert + assessment/condition/gap inserts in one transaction). Used by both run entry points. |
| `db/dump.js` | Regenerates `db/dump.sql` from `dsca.db` via the sqlite3 CLI. Called automatically after a run writes new rows. |
| `db/dump.sql` | Text, version-controlled SQL dump of `dsca.db` (the binary db is gitignored). Rebuild: `sqlite3 dsca.db < db/dump.sql`. |
| `services/cms.js` | CMS Provider Data Catalog queries — city/state listing + per-facility F-tag/staffing data |
| `services/classifier.js` | Deterministic DSS rules — maps CMS data to C-1–C-7 conditions + DG-1–DG-5 gaps |
| `run-city.js` | Entry point — all SNFs in a city |
| `run-state.js` | Entry point — all SNFs in a state (paginated, handles 1,000+ facility states) |
| `query-server.js` | Express server for the query runner (port 3010) |
| `queries/library.js` | All named analytical queries — add new queries here |
| `public/index.html` | Query runner browser UI |

---

## Schema Tables

| Table | One row per | Key fields |
|---|---|---|
| `facility` | Real-world facility | name, region, city, zip_code, urban_flag, latitude, longitude, care_type, source_system, source_facility_id |
| `assessment` | DSCA run | exposure_level, Five-Star, staffing_hprd, staffing_hprd_pbj, rn_hprd, turnover, ownership_type |
| `condition` | Condition found | classification, dss_domain, dss_domain_secondary, recognition_risk, source_citation_value, source_count |
| `citation` | Individual source citation | source_citation_value (F-tag), citation_date, severity_code (CMS A–L), survey_type, inspection_cycle — backs the condition counts; enables recency weighting and severity analysis |
| `data_gap` | Named gap | materiality, availability, record_needed, absence_implication |
| `evidence` | Clinical claim | basis_type, evidence_strength, source_reference (populated at engagement time only) |
| `exposure_estimate` | Scenario row | scenario, resident_count, prevalence_pct (populated at engagement time only) |

---

## SNF Condition Set (C-1 to C-7)

| Code | Condition | F-tag | DSS Domain | Risk |
|---|---|---|---|---|
| C-1 | Fall-Seizure Nexus | F-689 | 2 | Moderate |
| C-2 | Pharmacy / Medication | F-755 | 3+4 | High |
| C-3 | Professional Standards | F-658 | 3+4 | High |
| C-4 | Behavioral Health & Staff Competency | F-740/741 | 3+4 | High |
| C-5 | Five-Star Component Discrepancy | CMS Five-Star | 2 | Moderate |
| C-6 | Staffing Profile | CMS Staffing | 3+4 | High |
| C-7 | Special Focus / Enforcement | CMS Enforcement | — | — |

**Classification thresholds (severity-weighted, 2026-06-09):** citations weighted by CMS severity (A–F ×1 · G–I ×2 · J–L ×3), then weighted score ≥2 = Recognized · >0 = Potential · 0 = Not Identified. A single actual-harm or IJ citation is Recognized on its own. Recency weighting was modeled and rejected (survey-scheduling distortions) — recency is exposed via the Citation Detail queries instead.
**Staffing (C-6):** Potential if HPRD < 3.8 OR RN HPRD < 0.75 OR turnover > 50% · Not Assessed if all three figures missing
**Five-Star (C-5):** Recognized if overall − health ≥ 2 · Potential if diff = 1 · Not Assessed if either rating missing

**Four classification states:** Recognized · Potential · Not Identified (assessed clean) · Not Assessed (data missing). The last two are distinct: "checked and clean" ≠ "couldn't check". Only Recognized/Potential are active findings. Only C-5/C-6 can be Not Assessed.

**Domain weighting (recurring question — full rationale in architecture-db.md):** Recognition risk tiers misattribution likelihood, not clinical importance. Domains 3/4 (most missed / most misattributed) = High; Domain 2 (partially recognized) = Moderate. Domain 2 is NOT minor — C-1 is the most prevalent Recognized condition in Missouri (225/487). Never default queries to `dss_domain IN (3,4)` without asking if Domain 2 belongs.

**Exposure floor rule (decided 2026-06-09):** no facility with a Recognized condition in any domain ranks Low — a Recognized finding floors exposure at Moderate. High/Moderate-High stay reserved for High-risk (Domain 3/4) conditions. Implemented in `classifier.js`; stored Missouri rows re-scored (3 moved Low → Moderate).

---

## Geographic Fields

Added to `facility` at state-run level. All sourced from CMS Provider Information — no extra API calls:

- `city` — `citytown` from CMS
- `zip_code` — ZIP code
- `urban_flag` — CMS urban/rural classification (`Y` / `N`)
- `latitude`, `longitude` — coordinates for future map visualization

The urban/rural split enables queries comparing DSS exposure between urban and rural facilities — a structural difference the literature predicts but which hasn't been tested at this scale.

---

## Staffing Fields

Two staffing figures collected for every facility:

- `staffing_hprd` — self-reported (`reported_total_nurse_staffing_hours_per_resident_per_day`)
- `staffing_hprd_pbj` — payroll-based, independently verified (`total_number_of_nurse_staff_hours_per_resident_per_day_on_t_4a14`)

The gap between the two is itself an analytical signal — facilities that over-report staffing relative to payroll may have documentation integrity problems co-occurring with F-658. No PBJ breakdown by RN is published by CMS, so `rn_hprd` is reported-only.

---

## Assessment ID Format

`DSCA-YYYYMM-STATE-CCN` — e.g. `DSCA-202606-MO-265399`

Re-runs skip any CCN already in the database. Delete `dsca.db` to start fresh.

---

## When Zotero and Claude Enter

They don't enter in this pipeline. The state/city run is the deterministic layer — CMS in, DSS classification out. No API cost per facility.

Zotero + PubMed + Claude enter when a specific facility becomes a live engagement. At that point: pull the facility's existing row, run the full synthesis pipeline on top of it. The `evidence` and `exposure_estimate` tables are populated then, not by the city/state run.

That synthesis layer is a future build on this database. Its reference implementation is `~/crisp-dsca` — the prompts, Zotero search, GRADE scoring, and DSCA report structure there define what gets layered onto dsca.db rows.

---

## Current Data

| State | Run date | Facilities | Errors |
|---|---|---|---|
| Missouri (MO) | 2026-06-09 | 487 | 0 |

Missouri: 29 High · 221 Moderate-High · 228 Moderate · 9 Low · 289 urban · 198 rural · 242 cities

Data completeness: 22 conditions classified **Not Assessed** (6 C-5 missing Five-Star ratings, 16 C-6 missing all staffing figures) — distinct from assessed-clean. All other condition rows are Recognized / Potential / Not Identified.

---

## CMS-2567 Narrative Access — Future Build

The CMS Health Deficiencies dataset (`r5ix-sfxw`) has a `deficiency_description` field but it contains the regulatory standard text — the same boilerplate for every citation of a given F-tag. It is not the surveyor's actual findings and is useless for DSS classification.

The actual surveyor narrative — what was observed at the specific facility — is only in the CMS-2567 Statement of Deficiencies PDF inspection reports, publicly available on CMS Care Compare per facility per inspection cycle. These PDFs are not in the structured API.

**Why this matters:** 2567 narrative text is the only way to classify Domain 1 findings from the CMS record. A tonic-clonic seizure that was mismanaged or underdocumented may appear in an F-689, F-658, or F-740 narrative — not as a seizure, but as the behavioral or documentation failure it produced. Claude reading the narrative can identify it. The structured API cannot.

**When to build this:** Synthesis layer only, on live engagements. Not part of the deterministic batch pipeline.

**How to build it when ready:**

1. **Locate the PDF** — CMS Care Compare inspection reports are at a predictable URL pattern per CCN. Each inspection cycle produces one PDF. The URL format needs to be confirmed against the Care Compare interface.

2. **Extract text** — Use a PDF extraction library (e.g. `pdf-parse` in Node.js) to pull raw text from the inspection report. The 2567 has a predictable structure: F-tag header, regulatory text, then the surveyor's findings narrative.

3. **Run Claude on the narrative** — Pass the extracted text with a targeted prompt: identify any language describing seizure events, post-ictal states, loss of consciousness, unwitnessed falls with confusion, or behavioral changes that staff attributed to dementia. Map each finding to DSS domain and record certainty tier.

4. **Write to the evidence table** — Results go into the `evidence` table against the existing assessment row for that facility. `basis_type` = `'Literature-Supported'` if the narrative matches established clinical patterns; `'Expert Inference'` if the classification requires judgment. `source_reference` = CMS-2567 citation identifier.

5. **Domain 1 scope note** — Even with 2567 access, not all convulsive seizures in a dementia population are within DSS Framework scope. A resident with longstanding epilepsy predating dementia is a different clinical scenario than one whose seizure activity is driven by Alzheimer's pathology. Claude should flag Domain 1 candidates for Russ's review rather than auto-classifying them.

---

## Next States

Missouri is complete. To add a state: `node run-state.js <STATE_CODE>`

Re-runs are safe — existing CCNs are skipped. Running a second state adds its facilities alongside Missouri in the same database. State comparison queries in the Geographic category become meaningful once two or more states are loaded.
