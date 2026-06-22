# The DSS Index US Map — Architecture Snapshot

**File:** `public/map.html` (served at `/map.html`)
**Stack:** Leaflet 1.9.4, MarkerCluster 1.5.3, TopoJSON Client 3, Express API backend
**Purpose:** Choropleth exposure map of US nursing facilities by state-level seizure-related deficiency risk, with click-to-drill-down to individual facility markers.

---

## Key Architecture Points

- **Three data sources loaded in parallel on boot:** US Atlas TopoJSON (state boundaries), `/api/facilities/map/states` (state-level exposure aggregates), `/api/states` (dropdown list)
- **Choropleth layer:** GeoJSON from TopoJSON, colored by `high_pct + mh_pct` composite (exposureColor function)
- **State name mapping:** Full state name (from atlas) → abbreviation (from our API) via hardcoded `stateToAbbr` lookup
- **Popup drill-down:** Click a state → popup shows facility counts + exposure percentages + "View facilities →" link
- **Drill-down:** Click "View facilities" or select a state from dropdown → removes choropleth, adds MarkerClusterGroup with facility circles
- **Facility circles:** Sized by `sqrt(licensed_beds)`, colored by exposure level; clustered with MarkerCluster; popups show facility name, exposure badge, city, beds
- **"All States" / ← Back:** Returns to choropleth overview
- **Legend:** Collapsible (✕ to hide, + to reopen) with expandable "How is this measured?" note
- **Back navigation:** "← DSS Index" link below the brand returns to the query runner at `/`
- **Zoom controls:** Placed top-right via `L.control.zoom({ position: 'topright' })`, offset 50px below header
- **CDN dependencies:** Leaflet 1.9.4, MarkerCluster 1.5.3, TopoJSON Client 3 (all from unpkg/jsdelivr)
- **Mobile responsive:** Header compacts (smaller text, hides "State:" label, narrower dropdown), legend shrinks and repositions
