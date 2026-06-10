// DSCA State Run — all SNFs in a state from CMS, writes to dsca.db
// Usage: node run-state.js MO

const { initDB }                        = require('./db/init');
const { listFacilitiesByState,
        getFacilityRawData }            = require('./services/cms');
const { classifyFacility,
        buildAssessmentId }             = require('./services/classifier');
const { createWriter }                  = require('./db/write');
const { writeDump }                     = require('./db/dump');

const DELAY_MS = 200;

async function main() {
  const state = (process.argv[2] || 'MO').toUpperCase();

  console.log(`\nDSCA State Run — ${state}`);
  console.log('─'.repeat(50));

  const db = initDB();
  const { writeAssessment } = createWriter(db);

  console.log(`Fetching facility list from CMS...`);
  const providers = await listFacilitiesByState(state);

  if (!providers.length) {
    console.log('No facilities returned. Check state code.');
    db.close(); return;
  }

  console.log(`Found ${providers.length} facilities\n`);

  let written = 0, skipped = 0, errors = 0;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const ccn      = provider.cms_certification_number_ccn;
    const name     = provider.provider_name;

    try {
      const assessmentId = buildAssessmentId(state, ccn);
      const existing = db.prepare(
        'SELECT assessment_id FROM assessment WHERE assessment_id = ?'
      ).get(assessmentId);

      if (existing) {
        skipped++;
        process.stdout.write(`  — skipped: ${name}\n`);
        continue;
      }

      const { tagCounts, penaltyCount, citations } = await getFacilityRawData(ccn);
      const { facilityRow, assessmentRow, conditionRows, gapRows } =
        classifyFacility(assessmentId, provider, tagCounts, penaltyCount);

      writeAssessment(facilityRow, assessmentRow, conditionRows, gapRows, citations);
      written++;

      process.stdout.write(
        `  ✓ [${written + skipped + errors}/${providers.length}] ${name} → ${assessmentRow.exposure_level}\n`
      );

    } catch (err) {
      errors++;
      process.stdout.write(`  ✗ [${written + skipped + errors}/${providers.length}] ${name}: ${err.message}\n`);
    }

    await delay(DELAY_MS);
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`Written:  ${written}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Errors:   ${errors}`);
  console.log(`Total:    ${providers.length}`);
  console.log('');

  db.close();

  // Keep the version-controllable SQL dump current after any change.
  if (written > 0) writeDump();
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
