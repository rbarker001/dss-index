const express    = require('express');
const path       = require('path');
const { initDB } = require('./db/init');
const QUERIES    = require('./queries/library');

const app  = express();
const PORT = 3010;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = initDB();

// ── Facility list for selector ─────────────────────────────────────────────
app.get('/api/facilities', (req, res) => {
  const rows = db.prepare('SELECT name FROM facility ORDER BY name').all();
  res.json(rows.map(r => r.name));
});

// ── City list for selector ────────────────────────────────────────────────
app.get('/api/cities', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT city FROM facility WHERE city IS NOT NULL ORDER BY city').all();
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
  const { id, facility } = req.body;
  const query = QUERIES.find(q => q.id === id);
  if (!query) return res.status(404).json({ error: 'Query not found' });

  try {
    const { facility, city } = req.body;
    const params = (query.params || []).map(p => {
      if (p === 'facility') return facility || '';
      if (p === 'city')     return city     || '';
      return '';
    });
    const rows = db.prepare(query.sql).all(...params);
    res.json({ rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Drilldown ─────────────────────────────────────────────────────────────
app.post('/api/drilldown', (req, res) => {
  const { queryId, paramValue } = req.body;
  const query = QUERIES.find(q => q.id === queryId);
  if (!query?.drilldown) return res.status(404).json({ error: 'No drilldown for this query' });

  try {
    const rows = db.prepare(query.drilldown.sql).all(paramValue);
    res.json({ rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\nDSCA Query Runner — http://localhost:${PORT}\n`);
});
