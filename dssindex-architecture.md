# The DSS Index — Architecture Snapshot

**File:** `public/index.html` (served at `/`)
**Stack:** Vanilla JS, Express API backend
**Purpose:** Query-runner interface for 41 DSS framework SQL queries against the CMS deficiency database.

---

## Key Architecture Points

- **API endpoints consumed:** `/api/queries`, `/api/facilities`, `/api/cities`, `/api/states`, `/api/run`, `/api/drilldown`
- **State filter** scopes facility/city lists and re-runs current query against a state
- **Pin/Compare** pins a result set to a second panel for side-by-side comparison (renamed from "Pin" to "Compare" to signal purpose)
- **Drilldown** fetches detail rows by clicking a result row (queries with `drilldown` config); no sidebar indicator needed — the "↓ Click a row" hint appears in results when relevant
- **Export** produces CSV from any rendered table
- **Cell formatting** handles exposure level badges, classification badges, star ratings, domain labels
- **Collapsible sidebar** — hamburger button ☰ toggles sidebar on all screen sizes. On desktop, sidebar collapses to 0 width and content fills the space. On mobile (< 768px), sidebar slides in/out with a backdrop overlay.
- **Mobile responsive** — sidebar becomes fixed overlay, panels stack vertically, tables get horizontal scroll, header elements compact
- **Map link** — standalone "🗺 The DSS Index US Map" link at the top of the sidebar, opens in new tab

### Sidebar — 8 task-based categories

| Category | Queries | Purpose |
|---|---|---|
| Start Here | 3 | Exposure distribution, State comparison, Cities ranked by exposure |
| Find Facilities | 10 | High exposure, Priority target list, Clean facilities, Special focus/abuse, Below staffing benchmark, High turnover, Staffing+risk intersection, Full facility list, Facilities by city, Urban vs rural |
| DSS Domain Analysis | 10 | All 4 domains (1–4) individually + combined Domains 3+4 + multidomain overlap + by city + Potential-to-Recognized ratio + full ×domain matrix |
| Condition Deep-Dive | 6 | Condition breakdown, Recognized conditions, F-tag totals, Potential-dominant conditions, High-risk count, Five-Star by exposure |
| Staffing & Ownership | 5 | Ownership exposure, Reported vs PBJ, Over-reporters with F-658, Avg staffing by exposure, Staffing by city |
| Single Facility | 3 | Assessment snapshot, Full condition profile, Data gaps |
| Citation Detail | 3 | Citation recency, Severe citations (G+), Survey currency |
| Data Gaps | 1 | Gap inventory |
