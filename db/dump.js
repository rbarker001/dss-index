// Regenerate db/dump.sql — the text, version-controllable backup of the
// binary dsca.db. Shells out to the sqlite3 CLI so the output format matches
// the committed dump exactly (clean line-level diffs across runs).
//
// Call AFTER db.close() so the WAL is checkpointed into the main file.
// Non-fatal by design: a run that already wrote rows must not fail just
// because the dump could not be produced (e.g. sqlite3 CLI not installed).

const { execFileSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const DB_PATH   = path.join(__dirname, '..', 'dsca.db');
const DUMP_PATH = path.join(__dirname, 'dump.sql');

function writeDump() {
  try {
    const sql = execFileSync('sqlite3', [DB_PATH, '.dump'], {
      maxBuffer: 512 * 1024 * 1024
    });
    fs.writeFileSync(DUMP_PATH, sql);
    console.log(`Dump updated: ${path.relative(process.cwd(), DUMP_PATH)}`);
  } catch (err) {
    console.warn(
      `Dump skipped (${err.message}). Database is intact; regenerate manually:\n` +
      `  sqlite3 dsca.db .dump > db/dump.sql`
    );
  }
}

module.exports = { writeDump };
