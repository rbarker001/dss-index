# Missouri SNF Universe — DSS Framework Findings Summary

**Status: DRAFT — internal validation. Not for publication until reviewed by Russ and counsel.**

Run date: 2026-06-09 · 487 skilled nursing facilities · 242 cities · Data: CMS Provider Data Catalog (public)
Classification: DSS Framework deterministic rules (disclosed below) · No facility is named in this document.

---

## What This Is

Every Medicare/Medicaid-certified skilled nursing facility in Missouri was assessed through the Dementia Seizure Spectrum™ (DSS) Framework's deterministic classification layer. Inputs are exclusively public CMS data: health deficiency citations (F-tags), Five-Star ratings, staffing measures, and enforcement records. The classification rules are fixed and disclosed — no judgment is applied per facility, and no AI is involved in classification. This summary reports aggregate patterns only. It contains no facility-level findings and no facility names.

**What the classifications mean.** A "Recognized" condition means the pattern is established in the facility's public CMS record at the disclosed threshold (a severity-weighted citation score of ≥2 — repeat citations, or a single citation at actual-harm severity or worse — or a defined enforcement/rating signal). "Potential" means the signal is present below that threshold. These are *recognition-risk* classifications — they characterize what the regulatory record shows about a facility's documented capacity to recognize, document, and respond to the conditions under which seizure activity in dementia residents is most often missed. They are not determinations of care quality, not findings that seizure events occurred, and not predictions about any resident.

---

## Headline Findings

All figures computed from the assessment database on 2026-06-09. Provenance for each is in the appendix.

**1. Half the state's SNF universe carries elevated exposure.**
250 of 487 facilities (51%) classify as High (29) or Moderate-High (221) exposure. Only 9 facilities (1.8%) classify Low — meaning no high-risk condition active and no Recognized condition of any kind in their CMS record.

**2. The fall–seizure nexus is the most prevalent Recognized condition in the state.**
250 facilities (51%) carry a Recognized C-1 (Fall-Seizure Nexus: repeat F-689 citations, or a single citation at actual-harm severity or worse); another 118 (24%) carry it as Potential. 807 F-689 citations were counted statewide — the largest citation volume of any tag in scope, including 92 at immediate-jeopardy severity across all screened tags. [Re] Falls are the most visible surface of DSS Domain 2; the prevalence of this condition indicates how large the population is in which seizure-precipitated falls could go unattributed.

**3. Professional-standards citations are nearly as widespread.**
173 facilities (36%) carry a Recognized C-3 (F-658, services must meet professional standards; 639 citations statewide), and 153 more carry it as Potential. [Re] F-658 is the documentation-integrity signal: the condition under which subtle neurological events are least likely to be charted accurately.

**4. Staffing is below benchmark almost everywhere — and RN coverage is the starkest gap.**
- 342 facilities (70%) report total nurse staffing below the 3.8 HPRD national benchmark (state mean: 3.44).
- 433 facilities (89%) report RN hours below the 0.75 RN-HPRD benchmark (state mean: 0.46 — 39% below benchmark).
- 275 facilities (56%) report nursing turnover above 50% (state mean: 56.4%).

[Re] Staffing is the moderating variable for every recognition-risk condition: recognition of non-convulsive seizure presentations requires sustained observation by clinically trained staff. A state mean RN coverage 39% below benchmark is the single most consequential aggregate number in this dataset.

**5. Self-reported staffing exceeds payroll-verified staffing at 94% of facilities.**
460 of 487 facilities report staffing above their payroll-based (PBJ) figure. At 241 facilities (49%), the gap is ≥0.38 HPRD (≥10% of benchmark). State means: 3.44 reported vs 3.04 payroll-verified. 82 facilities combine a ≥10% over-report with a Recognized F-658 professional-standards condition. [Re] The reported-vs-PBJ gap is itself a documentation-integrity signal; its co-occurrence with F-658 is consistent with — though does not establish — a broader records-reliability problem at those facilities.

**6. The highest-risk intersection: 150 facilities.**
150 facilities (31%) combine at least one Recognized high-risk condition with total staffing below benchmark — the population where a documented recognition gap and the staffing conditions that produce one coincide.

**7. Urban facilities classify elevated more often than rural — the opposite of the expected direction.**
56% of urban facilities (161/289) classify High or Moderate-High versus 44% of rural (88/198). [Re] Literature-informed expectation was that rural facilities, with thinner clinical resources, would carry higher recognition risk. The reversal in this dataset is unexplained and should not be interpreted causally: candidate explanations include facility size, census, survey-frequency differences, and citation-exposure differences between urban and rural surveys. This is a research question, not a conclusion.

**8. Ownership structure separates the distribution.**
For-profit LLCs (178 facilities — the largest segment): 62% elevated, mean 3.24 HPRD. Non-profit corporations (62 facilities): 40% elevated, mean 4.21 HPRD. The non-profit "other" segment (12 facilities): 17% elevated. [Re] Ownership-linked staffing differences are well documented in the literature; the DSS-classified exposure gradient observed here is consistent with that pattern. Segment sizes below ~20 facilities are too small to characterize.

**9. Enforcement context.**
18 facilities carry Special Focus designation status and 64 carry a CMS abuse flag; 69 facilities (14%) classify Recognized on C-7 (enforcement) and 172 (35%) Potential (≥1 civil monetary penalty).

**10. Domain activity spans nearly the entire universe.**
475 facilities (97.5%) have at least one active Domain 3/4 condition (the misattribution domains — awareness and behavioral changes). 383 facilities (79%) have at least one active Domain 2 condition (movement/falls). Domain 1 (overt convulsive events) is structurally absent from this dataset by design — CMS deficiency data cannot establish it (see Limitations).

---

## Exposure Distribution

| Level | Facilities | Share |
|---|---|---|
| High | 29 | 6.0% |
| Moderate-High | 221 | 45.4% |
| Moderate | 228 | 46.8% |
| Low | 9 | 1.8% |

Definitions: High = ≥2 Recognized high-risk conditions. Moderate-High = 1 Recognized high-risk OR ≥3 active high-risk. Moderate = ≥1 active high-risk condition, or any Recognized condition in any domain (floor rule). Low = neither. High-risk conditions are those mapped to DSS Domains 3/4 (pharmacy, professional standards, behavioral-health competency, staffing).

## Condition Prevalence

| Condition | Signal | Recognized | Potential | Not Identified | Not Assessed |
|---|---|---|---|---|---|
| C-1 Fall-Seizure Nexus | F-689 | 250 | 118 | 119 | 0 |
| C-2 Pharmacy / Medication | F-755 | 44 | 111 | 332 | 0 |
| C-3 Professional Standards | F-658 | 173 | 153 | 161 | 0 |
| C-4 Behavioral Health & Competency | F-740/741 | 18 | 44 | 425 | 0 |
| C-5 Five-Star Discrepancy | CMS ratings | 0 | 38 | 443 | 6 |
| C-6 Staffing Profile | CMS staffing | 0 | 456 | 15 | 16 |
| C-7 Enforcement | SFF / penalties | 69 | 172 | 246 | 0 |

"Not Assessed" = the CMS data required to evaluate the condition was not published for that facility — distinct from assessed-and-clean. C-6 is never Recognized by design (continuous data, not citations); C-5 Recognized requires a ≥2-point rating discrepancy, which no Missouri facility currently shows.

---

## Scope, Methodology, and Limitations

**Sources.** CMS Provider Data Catalog, datasets 4pq5-n9py (Provider Information), r5ix-sfxw (Health Deficiencies), g6vv-u9sr (Penalties). Retrieved 2026-06-08/09. No non-public data was used. No facility was contacted.

**Classification rules (complete).** F-tag conditions are severity-weighted: each citation weighted by its CMS scope/severity letter (A–F no-harm ×1, G–I actual harm ×2, J–L immediate jeopardy ×3), then weighted score ≥2.0 = Recognized, >0 = Potential, 0 = Not Identified — so a single actual-harm or IJ citation classifies Recognized on its own. C-4 sums F-740+F-741. C-5: overall minus health-inspection rating ≥2 = Recognized, =1 = Potential. C-6: Potential if total HPRD <3.8 or RN HPRD <0.75 or turnover >50%; Not Assessed if all three absent. C-7: Recognized on Special Focus status or abuse flag, Potential on ≥1 penalty. Exposure levels as defined above.

**What this analysis cannot establish.**
1. *No seizure events are identified.* CMS deficiency data records regulatory findings, not clinical events. DSS Domain 1 (overt convulsive seizures) cannot be populated from this data and does not appear in these results.
2. *Recognition risk is not care quality.* A Recognized condition means a citation pattern exists in the public record at the disclosed threshold. It is not a determination that any facility provides deficient care, and the absence of conditions is not a certification of quality.
3. *Citations cover each facility's three most recent inspection cycles and are not time-weighted.* The CMS deficiency dataset retains the three most recent inspection cycles per facility (verified via the dataset's `inspection_cycle` field). In calendar terms this spans January 2019 – March 2026: COVID-era survey suspensions and backlog mean a delayed facility's third cycle reaches back to 2019, while a recently surveyed facility's three cycles span roughly 2023–2026. Counts are not date-weighted — a 2019 citation counts the same as a 2026 citation. Staffing, ratings, and turnover are by contrast a current monthly snapshot (turnover is a trailing 12-month measure).
4. *Staffing figures are facility-reported except where noted.* PBJ figures are payroll-derived; RN hours have no published PBJ equivalent and are reported-only.
5. *Aggregates conceal heterogeneity.* Nothing in this summary supports an inference about any individual facility.

**Framework attribution.** Classification logic: Dementia Seizure Spectrum™ Framework (Seagull Health). The derived variable — regulatory deficiencies reclassified as neurological recognition-risk signals, crossed with staffing — exists in no public dataset and is the analytical contribution of this work.

---

## Appendix — Claim Provenance

| Claim | Source |
|---|---|
| 487 facilities, 242 cities, urban/rural split | `facility` table counts |
| Exposure distribution 28/221/229/9 | `assessment.exposure_level` GROUP BY |
| Condition prevalence table | `condition` GROUP BY code × classification |
| Citation totals (807 F-689, 639 F-658, 219 F-755, 94 F-740/741) | SUM(`source_count`) by `source_citation_value` |
| Staffing means and below-benchmark counts | `assessment` staffing fields vs benchmarks 3.8 / 0.75 / 50% |
| Over-reporting (460; 241 ≥0.38 HPRD; 82 with Recognized F-658) | `staffing_hprd` − `staffing_hprd_pbj` joined to C-3 |
| 150-facility intersection | Recognized high-risk JOIN staffing <3.8 |
| Urban/rural elevated % (56 vs 44) | `facility.urban_flag` × `assessment.exposure_level` |
| Ownership gradient | `assessment.ownership_type` GROUP BY |
| Enforcement (18 SFF, 64 abuse, 69/172 C-7) | `assessment` flags; C-7 classifications |
| Domain activity (475 D3/4; 383 D2) | DISTINCT assessments with active conditions by `dss_domain` |

All queries executed against `dsca.db` 2026-06-09. Rule changes that altered stored data are recorded in the project git history.
