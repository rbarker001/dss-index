// Shared write layer for the deterministic pipeline. Both run-city.js and
// run-state.js persist a classified facility through this module so the
// INSERT statements and transaction boundary live in exactly one place.
//
// createWriter(db) prepares the statements once and returns writeAssessment,
// which upserts the facility and inserts the assessment, condition, and gap
// rows in a single transaction.

function createWriter(db) {
  const stmts = {
    selectFacility: db.prepare(
      'SELECT facility_id FROM facility WHERE source_system = ? AND source_facility_id = ?'
    ),
    insertFacility: db.prepare(`
      INSERT INTO facility (name, country, region, city, zip_code, urban_flag, latitude, longitude, care_type, licensed_beds, source_system, source_facility_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertAssessment: db.prepare(`
      INSERT INTO assessment (
        assessment_id, facility_id, assessment_date, market,
        exposure_level, overall_rating, health_inspection_rating,
        qm_rating, staffing_rating, staffing_hprd, staffing_hprd_pbj, rn_hprd,
        nursing_turnover_pct, ownership_type, special_focus_flag, abuse_flag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    `),
    insertCitation: db.prepare(`
      INSERT INTO citation (assessment_id, source_citation_type, source_citation_value, citation_date, severity_code, survey_type, inspection_cycle)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
  };

  // db.transaction() returns a function that runs the body atomically.
  // citationRows is optional for backward compatibility.
  const writeAssessment = db.transaction((facilityRow, assessmentRow, conditionRows, gapRows, citationRows) => {
    // Upsert facility — reuse the existing row if this CCN is already known.
    const existing = stmts.selectFacility.get('CMS', facilityRow.source_facility_id);
    const facilityId = existing
      ? existing.facility_id
      : stmts.insertFacility.run(
          facilityRow.name, facilityRow.country, facilityRow.region,
          facilityRow.city, facilityRow.zip_code, facilityRow.urban_flag,
          facilityRow.latitude, facilityRow.longitude,
          facilityRow.care_type, facilityRow.licensed_beds,
          facilityRow.source_system, facilityRow.source_facility_id
        ).lastInsertRowid;

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

    for (const c of (citationRows || [])) {
      stmts.insertCitation.run(
        assessmentRow.assessment_id,
        c.source_citation_type, c.source_citation_value,
        c.citation_date, c.severity_code, c.survey_type, c.inspection_cycle
      );
    }
  });

  return { writeAssessment };
}

module.exports = { createWriter };
