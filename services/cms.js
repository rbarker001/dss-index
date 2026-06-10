// CMS Provider Data Catalog — no API key required
// Datasets: 4pq5-n9py (Provider Info), r5ix-sfxw (Deficiencies), g6vv-u9sr (Penalties)

const CMS_BASE = 'https://data.cms.gov/provider-data/api/1/datastore/query';

const PROVIDER_DATASET   = '4pq5-n9py';
const DEFICIENCY_DATASET = 'r5ix-sfxw';
const PENALTY_DATASET    = 'g6vv-u9sr';

const FTAGS = [
  { tag: '0689', label: 'F-689' },
  { tag: '0755', label: 'F-755' },
  { tag: '0658', label: 'F-658' },
  { tag: '0740', label: 'F-740' },
  { tag: '0741', label: 'F-741' }
];

function buildParams(conditions, { limit = 1, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit, offset });
  conditions.forEach((c, i) => {
    params.set(`conditions[${i}][property]`, c.property);
    params.set(`conditions[${i}][value]`,    c.value);
    params.set(`conditions[${i}][operator]`, c.operator || '=');
  });
  return params;
}

async function fetchCMS(dataset, conditions, opts = {}) {
  const url = `${CMS_BASE}/${dataset}/0?${buildParams(conditions, opts)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CMS ${res.status}: ${url}`);
  return res.json();
}

async function listFacilitiesByCity(city, state) {
  const data = await fetchCMS(
    PROVIDER_DATASET,
    [
      { property: 'citytown', value: city.toUpperCase() },
      { property: 'state',         value: state.toUpperCase() }
    ],
    { limit: 500 }
  );
  return data.results || [];
}

async function listFacilitiesByState(state) {
  const stateUpper = state.toUpperCase();
  const all = [];
  const PAGE = 500;
  let offset = 0;

  while (true) {
    const data = await fetchCMS(
      PROVIDER_DATASET,
      [{ property: 'state', value: stateUpper }],
      { limit: PAGE, offset }
    );
    const results = data.results || [];
    all.push(...results);
    if (results.length < PAGE) break;
    offset += PAGE;
  }

  return all;
}

async function getFacilityRawData(ccn) {
  const [tagCounts, penaltyCount] = await Promise.all([
    Promise.all(
      FTAGS.map(f =>
        fetchCMS(
          DEFICIENCY_DATASET,
          [
            { property: 'cms_certification_number_ccn', value: ccn },
            { property: 'deficiency_tag_number',        value: f.tag }
          ]
        ).then(d => ({ tag: f.tag, count: d.count || 0 }))
      )
    ),
    fetchCMS(
      PENALTY_DATASET,
      [{ property: 'cms_certification_number_ccn', value: ccn }]
    ).then(d => d.count || 0)
  ]);

  const byTag = {};
  for (const t of tagCounts) byTag[t.tag] = t.count;

  return { tagCounts: byTag, penaltyCount };
}

module.exports = { listFacilitiesByCity, listFacilitiesByState, getFacilityRawData };
