// Demo run — dummy facilities, no CMS API calls
// Shows exactly what the real city run produces
// Usage: node demo.js

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { classifyFacility, buildAssessmentId } = require('./services/classifier');

// ── Dummy facilities (Kansas City, MO) ───────────────────────────────────────
const DUMMY_PROVIDERS = [
  {
    cms_certification_number_ccn: '265399',
    provider_name: 'Maplewood Skilled Nursing & Rehabilitation',
    state: 'MO',
    number_of_certified_beds: '60',
    overall_rating: '3',
    health_inspection_rating: '2',
    qm_rating: '4',
    staffing_rating: '3',
    reported_total_nurse_staffing_hours_per_resident_per_day: '3.4',
    reported_rn_staffing_hours_per_resident_per_day: '0.62',
    total_nursing_staff_turnover: '68',
    ownership_type: 'For profit - Limited Liability company',
    special_focus_status: 'Not a Candidate',
    abuse_icon: 'N'
  },
  {
    cms_certification_number_ccn: '265401',
    provider_name: 'Riverside Care Center',
    state: 'MO',
    number_of_certified_beds: '120',
    overall_rating: '5',
    health_inspection_rating: '5',
    qm_rating: '5',
    staffing_rating: '4',
    reported_total_nurse_staffing_hours_per_resident_per_day: '4.1',
    reported_rn_staffing_hours_per_resident_per_day: '0.82',
    total_nursing_staff_turnover: '38',
    ownership_type: 'Non profit - Corporation',
    special_focus_status: 'Not a Candidate',
    abuse_icon: 'N'
  },
  {
    cms_certification_number_ccn: '265412',
    provider_name: 'Westview Nursing Home',
    state: 'MO',
    number_of_certified_beds: '90',
    overall_rating: '2',
    health_inspection_rating: '1',
    qm_rating: '3',
    staffing_rating: '2',
    reported_total_nurse_staffing_hours_per_resident_per_day: '3.1',
    reported_rn_staffing_hours_per_resident_per_day: '0.55',
    total_nursing_staff_turnover: '82',
    ownership_type: 'For profit - Corporation',
    special_focus_status: 'Special Focus Facility',
    abuse_icon: 'N'
  },
  {
    cms_certification_number_ccn: '265388',
    provider_name: 'Prairie Village SNF',
    state: 'MO',
    number_of_certified_beds: '45',
    overall_rating: '4',
    health_inspection_rating: '4',
    qm_rating: '4',
    staffing_rating: '3',
    reported_total_nurse_staffing_hours_per_resident_per_day: '3.6',
    reported_rn_staffing_hours_per_resident_per_day: '0.71',
    total_nursing_staff_turnover: '55',
    ownership_type: 'For profit - Individual',
    special_focus_status: 'Not a Candidate',
    abuse_icon: 'N'
  },
  {
    cms_certification_number_ccn: '265455',
    provider_name: 'Crossroads Rehabilitation & Living',
    state: 'MO',
    number_of_certified_beds: '200',
    overall_rating: '1',
    health_inspection_rating: '1',
    qm_rating: '2',
    staffing_rating: '1',
    reported_total_nurse_staffing_hours_per_resident_per_day: '2.8',
    reported_rn_staffing_hours_per_resident_per_day: '0.41',
    total_nursing_staff_turnover: '91',
    ownership_type: 'For profit - Corporation',
    special_focus_status: 'Special Focus Candidate',
    abuse_icon: 'Y'
  }
];

// Dummy F-tag counts per facility (keyed by CCN)
const DUMMY_FTAGS = {
  '265399': { '0689': 3, '0755': 1, '0658': 2, '0740': 1, '0741': 0 },
  '265401': { '0689': 0, '0755': 0, '0658': 0, '0740': 0, '0741': 0 },
  '265412': { '0689': 5, '0755': 3, '0658': 4, '0740': 2, '0741': 1 },
  '265388': { '0689': 1, '0755': 0, '0658': 1, '0740': 0, '0741': 0 },
  '265455': { '0689': 7, '0755': 4, '0658': 6, '0740': 3, '0741': 2 }
};

const DUMMY_PENALTIES = {
  '265399': 0,
  '265401': 0,
  '265412': 3,
  '265388': 0,
  '265455': 8
};

// ── In-memory DB for demo ────────────────────────────────────────────────────
function initDemoDB() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

function prepareStatements(db) {
  return {
    insertFacility: db.prepare(`
      INSERT INTO facility (name, country, region, care_type, licensed_beds, source_system, source_facility_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    insertAssessment: db.prepare(`
      INSERT INTO assessment (
        assessment_id, facility_id, assessment_date, market,
        exposure_level, overall_rating, health_inspection_rating,
        qm_rating, staffing_rating, staffing_hprd, rn_hprd,
        nursing_turnover_pct, ownership_type, special_focus_flag, abuse_flag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertCondition: db.prepare(`
      INSERT INTO condition (
        assessment_id, condition_code, condition_name, classification,
        dss_domain, dss_domain_secondary, recognition_risk, description,
        source_citation_type, source_citation_value, source_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertGap: db.prepare(`
      INSERT INTO data_gap (assessment_id, gap_code, materiality, availability, record_needed, absence_implication)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
  };
}

function writeAssessment(db, stmts, facilityRow, assessmentRow, conditionRows, gapRows) {
  db.transaction(() => {
    const r = stmts.insertFacility.run(
      facilityRow.name, facilityRow.country, facilityRow.region,
      facilityRow.care_type, facilityRow.licensed_beds,
      facilityRow.source_system, facilityRow.source_facility_id
    );
    const facilityId = r.lastInsertRowid;

    stmts.insertAssessment.run(
      assessmentRow.assessment_id, facilityId,
      assessmentRow.assessment_date, assessmentRow.market,
      assessmentRow.exposure_level,
      assessmentRow.overall_rating, assessmentRow.health_inspection_rating,
      assessmentRow.qm_rating, assessmentRow.staffing_rating,
      assessmentRow.staffing_hprd, assessmentRow.rn_hprd,
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

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log('\nDSCA City Run — Kansas City, MO  [DEMO — dummy data]');
  console.log('─'.repeat(55));
  console.log(`Found ${DUMMY_PROVIDERS.length} facilities\n`);

  const db    = initDemoDB();
  const stmts = prepareStatements(db);

  let written = 0;

  for (let i = 0; i < DUMMY_PROVIDERS.length; i++) {
    const provider    = DUMMY_PROVIDERS[i];
    const ccn         = provider.cms_certification_number_ccn;
    const tagCounts   = DUMMY_FTAGS[ccn];
    const penaltyCount = DUMMY_PENALTIES[ccn];
    const assessmentId = buildAssessmentId('MO', ccn);

    const { facilityRow, assessmentRow, conditionRows, gapRows } =
      classifyFacility(assessmentId, provider, tagCounts, penaltyCount);

    writeAssessment(db, stmts, facilityRow, assessmentRow, conditionRows, gapRows);
    written++;
    console.log(`  ✓ [${i+1}/${DUMMY_PROVIDERS.length}] ${provider.provider_name} → ${assessmentRow.exposure_level}`);
  }

  console.log('\n' + '─'.repeat(55));
  console.log(`Written: ${written}  |  Errors: 0  |  Total: ${DUMMY_PROVIDERS.length}`);

  // ── Example queries ─────────────────────────────────────────────────────────
  console.log('\n\n══ EXAMPLE QUERIES ══════════════════════════════════════\n');

  // 1. All facilities with exposure level
  console.log('── Exposure distribution ───────────────────────────────');
  const exposure = db.prepare(`
    SELECT a.exposure_level, COUNT(*) as count
    FROM assessment a
    GROUP BY a.exposure_level
    ORDER BY count DESC
  `).all();
  exposure.forEach(r => console.log(`  ${r.exposure_level.padEnd(16)} ${r.count} facilit${r.count === 1 ? 'y' : 'ies'}`));

  // 2. Every facility with a Recognized condition in DSS Domain 4
  console.log('\n── Facilities with Recognized condition in DSS Domain 3 or 4 ──');
  const domain4 = db.prepare(`
    SELECT DISTINCT f.name, a.exposure_level, c.condition_name, c.classification, c.dss_domain
    FROM condition c
    JOIN assessment a ON c.assessment_id = a.assessment_id
    JOIN facility f   ON a.facility_id   = f.facility_id
    WHERE c.classification = 'Recognized'
      AND c.dss_domain IN (3, 4)
    ORDER BY f.name
  `).all();
  if (domain4.length) {
    domain4.forEach(r =>
      console.log(`  ${r.name.padEnd(42)} ${r.condition_name} (Domain ${r.dss_domain})`)
    );
  } else {
    console.log('  None');
  }

  // 3. Full condition breakdown for one facility
  console.log('\n── Condition breakdown — Maplewood ────────────────────');
  const maplewood = db.prepare(`
    SELECT c.condition_code, c.condition_name, c.classification, c.recognition_risk,
           c.dss_domain, c.source_count
    FROM condition c
    JOIN assessment a ON c.assessment_id = a.assessment_id
    JOIN facility f   ON a.facility_id   = f.facility_id
    WHERE f.name = 'Maplewood Skilled Nursing & Rehabilitation'
    ORDER BY c.condition_code
  `).all();
  maplewood.forEach(r => {
    const domain = r.dss_domain ? `Domain ${r.dss_domain}` : '—';
    const risk   = r.recognition_risk || '—';
    const count  = r.source_count !== null ? `(${r.source_count} citations)` : '';
    console.log(`  ${r.condition_code}  ${r.classification.padEnd(14)} ${risk.padEnd(8)} ${domain.padEnd(10)} ${r.condition_name} ${count}`);
  });

  // 4. Staffing below benchmark
  console.log('\n── Facilities with staffing below benchmark ────────────');
  const staffing = db.prepare(`
    SELECT f.name, a.staffing_hprd, a.rn_hprd, a.nursing_turnover_pct, a.exposure_level
    FROM assessment a
    JOIN facility f ON a.facility_id = f.facility_id
    WHERE a.staffing_hprd < 3.8 OR a.rn_hprd < 0.75
    ORDER BY a.staffing_hprd ASC
  `).all();
  staffing.forEach(r =>
    console.log(`  ${r.name.padEnd(42)} ${r.staffing_hprd} hprd  ${r.rn_hprd} RN  ${r.nursing_turnover_pct}% turnover`)
  );

  // 5. Share of conditions by classification
  console.log('\n── All conditions — classification breakdown ───────────');
  const classBreakdown = db.prepare(`
    SELECT classification, COUNT(*) as count
    FROM condition
    GROUP BY classification
    ORDER BY count DESC
  `).all();
  const total = classBreakdown.reduce((s, r) => s + r.count, 0);
  classBreakdown.forEach(r =>
    console.log(`  ${r.classification.padEnd(16)} ${r.count} (${Math.round(r.count/total*100)}%)`)
  );

  console.log('');
  db.close();
}

main();
