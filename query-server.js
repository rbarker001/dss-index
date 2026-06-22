const express    = require('express');
const path       = require('path');
const { initDB } = require('./db/init');
const QUERIES    = require('./queries/library');

const app  = express();
const PORT = 3010;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = initDB();

// ── Helpers ──────────────────────────────────────────────────────────────────

// Inject a state (f.region) filter into a query SQL without modifying the
// query library. Handles three shapes:
//   1. Queries that JOIN facility f → add AND f.region = ?
//   2. Queries that FROM facility f → add AND/WHERE f.region = ?
//   3. Assessment-only queries → wrap with a subquery filter
function addStateFilter(sql, state) {
  if (!state) return { sql, params: [] };

  const joinsFacility = /\bJOIN\s+facility\s+f\b/i.test(sql)
                     || /\bFROM\s+facility\s+f\b/i.test(sql);

  if (!joinsFacility) {
    // Table-only query — inject EXISTS subquery filtering through facility.
    // condition/data_gap use assessment_id bridge; assessment has facility_id.
    const sqlKeywords = new Set(['WHERE', 'GROUP', 'ORDER', 'LIMIT', 'LEFT', 'RIGHT', 'INNER', 'CROSS', 'JOIN', 'HAVING']);
    const fromMatch = sql.match(/\bFROM\s+(assessment|condition|data_gap)(?:\s+(\w+))?\b/i);
    const tableName = fromMatch ? fromMatch[1] : 'assessment';
    const alias     = (fromMatch && fromMatch[2] && !sqlKeywords.has(fromMatch[2].toUpperCase())) ? fromMatch[2] : tableName;
    const hasWhereA = /\bWHERE\b/i.test(sql);
    const groupByA  = sql.match(/\bGROUP\s+BY\b/i);
    const orderByA  = sql.match(/\bORDER\s+BY\b/i);
    const limitA    = sql.match(/\bLIMIT\b/i);
    const insertAtA = groupByA ? groupByA.index
                    : (orderByA ? orderByA.index
                    : (limitA   ? limitA.index
                    : sql.length));
    // Bridge: condition/data_gap → assessment → facility
    const bridge = tableName === 'assessment'
      ? `f.facility_id = ${alias}.facility_id`
      : `a.assessment_id = ${alias}.assessment_id`;
    const joins  = tableName === 'assessment' ? 'facility f' : 'assessment a JOIN facility f ON a.facility_id = f.facility_id';
    const clauseA = hasWhereA
      ? `AND EXISTS (SELECT 1 FROM ${joins} WHERE ${bridge} AND f.region = ?)`
      : `WHERE EXISTS (SELECT 1 FROM ${joins} WHERE ${bridge} AND f.region = ?)`;
    return {
      sql: `${sql.slice(0, insertAtA)}${clauseA} ${sql.slice(insertAtA)}`,
      params: [state]
    };
  }

  const hasWhere   = /\bWHERE\b/i.test(sql);
  const groupBy    = sql.match(/\bGROUP\s+BY\b/i);
  const orderBy    = sql.match(/\bORDER\s+BY\b/i);
  const limit      = sql.match(/\bLIMIT\b/i);
  // Insert before the earliest clause after FROM — GROUP BY comes first,
  // then ORDER BY, then LIMIT
  const insertAt   = groupBy ? groupBy.index
                   : (orderBy ? orderBy.index
                   : (limit   ? limit.index
                   : sql.length));
  const clause     = hasWhere ? ' AND f.region = ?' : ' WHERE f.region = ?';
  const before     = sql.slice(0, insertAt);
  const after      = sql.slice(insertAt);

  return { sql: `${before}${clause} ${after}`, params: [state] };
}

// ── Map data — state aggregates (fast overview) ──────────────────────────
app.get('/api/facilities/map/states', (req, res) => {
  const sql = `
    SELECT f.region AS state,
           COUNT(*) AS facilities,
           ROUND(AVG(f.latitude),  4) AS lat,
           ROUND(AVG(f.longitude), 4) AS lng,
           ROUND(100.0 * SUM(CASE WHEN a.exposure_level = 'High'          THEN 1 ELSE 0 END) / COUNT(*), 1) AS high_pct,
           ROUND(100.0 * SUM(CASE WHEN a.exposure_level = 'Moderate-High' THEN 1 ELSE 0 END) / COUNT(*), 1) AS mh_pct,
           ROUND(100.0 * SUM(CASE WHEN a.exposure_level = 'Moderate'      THEN 1 ELSE 0 END) / COUNT(*), 1) AS mod_pct,
           ROUND(100.0 * SUM(CASE WHEN a.exposure_level = 'Low'           THEN 1 ELSE 0 END) / COUNT(*), 1) AS low_pct
    FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
    WHERE f.latitude IS NOT NULL AND f.longitude IS NOT NULL
    GROUP BY f.region
    ORDER BY f.region`;
  const rows = db.prepare(sql).all();
  res.json({ rows, count: rows.length });
});

// ── Map data — individual facilities (state filtered) ────────────────────
app.get('/api/facilities/map', (req, res) => {
  const state = req.query.state || '';
  const sql = state
    ? `SELECT f.name, f.latitude, f.longitude, a.exposure_level, f.licensed_beds, f.city, f.region
       FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
       WHERE f.region = ? AND f.latitude IS NOT NULL AND f.longitude IS NOT NULL
       ORDER BY f.name`
    : `SELECT f.name, f.latitude, f.longitude, a.exposure_level, f.licensed_beds, f.city, f.region
       FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
       WHERE f.latitude IS NOT NULL AND f.longitude IS NOT NULL
       ORDER BY f.name`;
  const rows = db.prepare(sql).all(...(state ? [state] : []));
  res.json({ rows, count: rows.length });
});

// ── State list for selector ───────────────────────────────────────────────
app.get('/api/states', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT region FROM facility WHERE region IS NOT NULL ORDER BY region').all();
  res.json(rows.map(r => r.region));
});

// ── Facility list for selector ─────────────────────────────────────────────
app.get('/api/facilities', (req, res) => {
  const state = req.query.state || '';
  const sql = state
    ? 'SELECT name FROM facility WHERE region = ? ORDER BY name'
    : 'SELECT name FROM facility ORDER BY name';
  const rows = db.prepare(sql).all(...(state ? [state] : []));
  res.json(rows.map(r => r.name));
});

// ── City list for selector ────────────────────────────────────────────────
app.get('/api/cities', (req, res) => {
  const state = req.query.state || '';
  const sql = state
    ? 'SELECT DISTINCT city FROM facility WHERE region = ? AND city IS NOT NULL ORDER BY city'
    : 'SELECT DISTINCT city FROM facility WHERE city IS NOT NULL ORDER BY city';
  const rows = db.prepare(sql).all(...(state ? [state] : []));
  res.json(rows.map(r => r.city));
});

// ── Query library metadata (no SQL sent to client) ────────────────────────
app.get('/api/queries', (req, res) => {
  res.json(QUERIES.map(q => ({
    id:          q.id,
    category:    q.category,
    title:       q.title,
    description: q.description,
    params:      q.params || [],
    drilldown:   q.drilldown
      ? { paramCol: q.drilldown.paramCol, title: q.drilldown.title }
      : null
  })));
});

// ── Run a query ────────────────────────────────────────────────────────────
app.post('/api/run', (req, res) => {
  const { id } = req.body;
  const query = QUERIES.find(q => q.id === id);
  if (!query) return res.status(404).json({ error: 'Query not found' });

  try {
    const { facility, city, state } = req.body;
    const params = (query.params || []).map(p => {
      if (p === 'facility') return facility || '';
      if (p === 'city')     return city     || '';
      return '';
    });

    const { sql, params: stateParams } = addStateFilter(query.sql, state);
    const allParams = [...stateParams, ...params];
    const rows = db.prepare(sql).all(...allParams);
    res.json({ rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Drilldown ─────────────────────────────────────────────────────────────
app.post('/api/drilldown', (req, res) => {
  const { queryId, paramValue, state } = req.body;
  const query = QUERIES.find(q => q.id === queryId);
  if (!query?.drilldown) return res.status(404).json({ error: 'No drilldown for this query' });

  try {
    const { sql, params: stateParams } = addStateFilter(query.drilldown.sql, state);
    const allParams = [...stateParams, paramValue];
    const rows = db.prepare(sql).all(...allParams);
    res.json({ rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\nDSCA Query Runner — http://localhost:${PORT}\n`);
});
