// DSCA City Run — pulls all SNFs in a city from CMS and writes structured rows to SQLite
// Usage: node run-city.js "Kansas City" MO

const { initDB }                        = require('./db/init');
const { listFacilitiesByCity,
        getFacilityRawData }            = require('./services/cms');
const { classifyFacility,
        buildAssessmentId }             = require('./services/classifier');
const { createWriter }                  = require('./db/write');
const { writeDump }                     = require('./db/dump');

const DELAY_MS = 300; // between facilities — respectful to CMS API

async function main() {
  const city  = process.argv[2] || 'Kansas City';
  const state = process.argv[3] || 'MO';

  console.log(`\nDSCA City Run — ${city}, ${state}`);
  console.log('─'.repeat(50));

  const db = initDB();
  const { writeAssessment } = createWriter(db);

  console.log(`Fetching facility list from CMS...`);
  const providers = await listFacilitiesByCity(city, state);

  if (!providers.length) {
    console.log('No facilities returned. Check city/state spelling and try again.');
    db.close();
    return;
  }

  console.log(`Found ${providers.length} facilities\n`);

  let written = 0;
  let skipped = 0;
  let errors  = 0;

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
        console.log(`  — [${i+1}/${providers.length}] skipped (exists): ${name}`);
        skipped++;
        continue;
      }

      const { tagCounts, penaltyCount } = await getFacilityRawData(ccn);

      const { facilityRow, assessmentRow, conditionRows, gapRows } =
        classifyFacility(assessmentId, provider, tagCounts, penaltyCount);

      writeAssessment(facilityRow, assessmentRow, conditionRows, gapRows);

      written++;
      console.log(`  ✓ [${i+1}/${providers.length}] ${name} → ${assessmentRow.exposure_level}`);

    } catch (err) {
      errors++;
      console.error(`  ✗ [${i+1}/${providers.length}] ${name} (${ccn}): ${err.message}`);
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

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
