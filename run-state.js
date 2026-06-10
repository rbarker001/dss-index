// DSCA State Run — all SNFs in a state from CMS, writes to dsca.db
// Usage: node run-state.js MO

const { initDB }                        = require('./db/init');
const { listFacilitiesByState,
        getFacilityRawData }            = require('./services/cms');
const { classifyFacility,
        buildAssessmentId }             = require('./services/classifier');
const { writeDump }                     = require('./db/dump');

const DELAY_MS = 200;

async function main() {
  const state = (process.argv[2] || 'MO').toUpperCase();

  console.log(`\nDSCA State Run — ${state}`);
  console.log('─'.repeat(50));

  const db = initDB();
  prepareStatements(db);

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

      const { tagCounts, penaltyCount } = await getFacilityRawData(ccn);
      const { facilityRow, assessmentRow, conditionRows, gapRows } =
        classifyFacility(assessmentId, provider, tagCounts, penaltyCount);

      writeAssessment(db, facilityRow, assessmentRow, conditionRows, gapRows);
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

function writeAssessment(db, facilityRow, assessmentRow, conditionRows, gapRows) {
  db.transaction(() => {
    let facilityId;
    const existing = db.prepare(
      'SELECT facility_id FROM facility WHERE source_system = ? AND source_facility_id = ?'
    ).get('CMS', facilityRow.source_facility_id);

    if (existing) {
      facilityId = existing.facility_id;
    } else {
      const r = stmts.insertFacility.run(
        facilityRow.name, facilityRow.country, facilityRow.region,
        facilityRow.city, facilityRow.zip_code, facilityRow.urban_flag,
        facilityRow.latitude, facilityRow.longitude,
        facilityRow.care_type, facilityRow.licensed_beds,
        facilityRow.source_system, facilityRow.source_facility_id
      );
      facilityId = r.lastInsertRowid;
    }

    stmts.insertAssessment.run(
      assessmentRow.assessment_id, facilityId,
      assessmentRow.assessment_date, assessmentRow.market,
      assessmentRow.exposure_level,
      assessmentRow.overall_rating, assessmentRow.health_inspection_rating,
      assessmentRow.qm_rating, assessmentRow.staffing_rating,
      assessmentRow.staffing_hprd, assessmentRow.staffing_hprd_pbj, assessmentRow.rn_hprd,
      assessmentRow.nursing_turnover_pct, assessmentRow.ownership_type,
      assessmentRow.special_focus_flag, assessmentRow.abuse_flag
    );

    for (const c of conditionRows) {
      stmts.insertCondition.run(
        assessmentRow.assessment_id,
        c.condition_code, c.condition_name, c.classification,
        c.dss_domain, c.dss_domain_secondary,
        c.recognition_risk, c.description,
        c.source_citation_type, c.source_citation_value, c.source_count
      );
    }

    for (const g of gapRows) {
      stmts.insertGap.run(
        assessmentRow.assessment_id,
        g.gap_code, g.materiality, g.availability,
        g.record_needed, g.absence_implication
      );
    }
  })();
}

let stmts = {};
function prepareStatements(db) {
  stmts.insertFacility = db.prepare(`
    INSERT INTO facility (name, country, region, city, zip_code, urban_flag, latitude, longitude, care_type, licensed_beds, source_system, source_facility_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmts.insertAssessment = db.prepare(`
    INSERT INTO assessment (
      assessment_id, facility_id, assessment_date, market,
      exposure_level, overall_rating, health_inspection_rating,
      qm_rating, staffing_rating, staffing_hprd, staffing_hprd_pbj, rn_hprd,
      nursing_turnover_pct, ownership_type, special_focus_flag, abuse_flag
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmts.insertCondition = db.prepare(`
    INSERT INTO condition (
      assessment_id, condition_code, condition_name, classification,
      dss_domain, dss_domain_secondary, recognition_risk, description,
      source_citation_type, source_citation_value, source_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmts.insertGap = db.prepare(`
    INSERT INTO data_gap (assessment_id, gap_code, materiality, availability, record_needed, absence_implication)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
