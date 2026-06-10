// Deterministic DSS classification for SNF — no AI
// F-tag counts → condition rows (C-1 to C-7) + standard data gaps (DG-1 to DG-5)

const HPRD_BENCHMARK     = 3.8;
const RN_HPRD_BENCHMARK  = 0.75;
const TURNOVER_BENCHMARK = 50.0;

const SNF_DATA_GAPS = [
  {
    gap_code:           'DG-1',
    materiality:        'Recognized',
    availability:       'Available if Requested',
    record_needed:      'Pharmacy Records',
    absence_implication: 'Eliminates ability to assess tramadol/CYP2D6-inhibiting antidepressant combination; polypharmacy exposure is population-level inference only.'
  },
  {
    gap_code:           'DG-2',
    materiality:        'Recognized',
    availability:       'Available if Requested',
    record_needed:      'MDS Data and Clinical Records',
    absence_implication: 'Stress scenario becomes operative planning estimate by default; subclinical epileptiform exposure cannot be bounded at facility level.'
  },
  {
    gap_code:           'DG-3',
    materiality:        'Recognized',
    availability:       'Available if Requested',
    record_needed:      'Seizure Protocols and Staff Training Documentation',
    absence_implication: 'Cannot assess whether recognition risk has been partially addressed through internal measures.'
  },
  {
    gap_code:           'DG-4',
    materiality:        'Potential',
    availability:       'Available Independently',
    record_needed:      'State Licensing and Ombudsman Records',
    absence_implication: 'Conditions not yet reflected in CMS record may understate findings.'
  },
  {
    gap_code:           'DG-5',
    materiality:        'Potential',
    availability:       'Available if Requested',
    record_needed:      'Pending Enforcement and Litigation',
    absence_implication: 'Absence does not constitute a clean record; requires explicit seller representation and separate legal search.'
  }
];

function certify(count) {
  if (count >= 2) return 'Recognized';
  if (count === 1) return 'Potential';
  return 'Not Identified';
}

function buildAssessmentId(state, ccn) {
  const now  = new Date();
  const year = now.getFullYear();
  const mo   = String(now.getMonth() + 1).padStart(2, '0');
  return `DSCA-${year}${mo}-${state.toUpperCase()}-${ccn}`;
}

function classifyFacility(assessmentId, provider, tagCounts, penaltyCount) {
  const overall  = parseFloat(provider.overall_rating)           || null;
  const health   = parseFloat(provider.health_inspection_rating) || null;
  const hprd    = parseFloat(provider.reported_total_nurse_staffing_hours_per_resident_per_day)         || null;
  const hprdPbj = parseFloat(provider.total_number_of_nurse_staff_hours_per_resident_per_day_on_t_4a14) || null;
  const rnHprd  = parseFloat(provider.reported_rn_staffing_hours_per_resident_per_day)                  || null;
  const turnover = parseFloat(provider.total_nursing_staff_turnover) || null;
  const specialFocus = provider.special_focus_status &&
                       provider.special_focus_status !== 'Not a Candidate' &&
                       provider.special_focus_status !== '';
  const abuseFlag = provider.abuse_icon === 'Y';

  // ── Domain 1 scope boundary ───────────────────────────────────────────────
  // Domain 1 (overt convulsive seizures) is not classifiable from CMS F-tag data.
  // CMS deficiency citations are failure signals — a facility that correctly documents
  // and responds to a convulsive seizure produces no relevant citation. Domain 1
  // findings only emerge from clinical records review (nursing notes, incident reports)
  // which is flagged as missing in Data Gap DG-2.
  //
  // Additionally, not all convulsive seizures in a dementia population are within
  // DSS Framework scope. Seizures in residents with longstanding epilepsy predating
  // dementia may not reflect the dementia-seizure relationship the framework
  // characterizes. Domain 1 classification belongs in the synthesis layer only.

  // ── C-1: F-689 Fall-Seizure Nexus ────────────────────────────────────────
  const c1count = tagCounts['0689'] || 0;
  const C1 = {
    condition_code:       'C-1',
    condition_name:       'Fall-Seizure Nexus',
    classification:       certify(c1count),
    dss_domain:           2,
    dss_domain_secondary: null,
    recognition_risk:     'Moderate',
    source_citation_type:  'CMS F-tag',
    source_citation_value: 'F-689',
    source_count:          c1count,
    description: `${c1count} F-689 citation(s); seizure-precipitated falls not consistently attributed.`
  };

  // ── C-2: F-755 Pharmacy / Medication ─────────────────────────────────────
  const c2count = tagCounts['0755'] || 0;
  const C2 = {
    condition_code:       'C-2',
    condition_name:       'Pharmacy / Medication Management',
    classification:       certify(c2count),
    dss_domain:           3,
    dss_domain_secondary: 4,
    recognition_risk:     'High',
    source_citation_type:  'CMS F-tag',
    source_citation_value: 'F-755',
    source_count:          c2count,
    description: `${c2count} F-755 citation(s); pharmacy services or medication management gap.`
  };

  // ── C-3: F-658 Professional Standards ────────────────────────────────────
  const c3count = tagCounts['0658'] || 0;
  const C3 = {
    condition_code:       'C-3',
    condition_name:       'Services Meet Professional Standards',
    classification:       certify(c3count),
    dss_domain:           3,
    dss_domain_secondary: 4,
    recognition_risk:     'High',
    source_citation_type:  'CMS F-tag',
    source_citation_value: 'F-658',
    source_count:          c3count,
    description: `${c3count} F-658 citation(s); professional standards of care gap.`
  };

  // ── C-4: F-740/741 Behavioral Health & Staff Competency ──────────────────
  const c4count = (tagCounts['0740'] || 0) + (tagCounts['0741'] || 0);
  const C4 = {
    condition_code:       'C-4',
    condition_name:       'Behavioral Health and Staff Competency',
    classification:       certify(c4count),
    dss_domain:           3,
    dss_domain_secondary: 4,
    recognition_risk:     'High',
    source_citation_type:  'CMS F-tag',
    source_citation_value: 'F-740/F-741',
    source_count:          c4count,
    description: `${c4count} F-740/F-741 citation(s); behavioral health services or staff competency gap.`
  };

  // ── C-5: Five-Star Component Discrepancy ─────────────────────────────────
  let c5classification, c5desc, c5count;
  if (overall !== null && health !== null) {
    const diff = overall - health;
    c5count = diff;
    c5classification = diff >= 2 ? 'Recognized' : diff === 1 ? 'Potential' : 'Not Identified';
    c5desc = diff > 0
      ? `${diff}-point negative discrepancy: health inspection ${health}/5 vs overall ${overall}/5.`
      : `No discrepancy; health inspection ${health}/5 at or above overall ${overall}/5.`;
  } else {
    c5count = null;
    c5classification = 'Not Identified';
    c5desc = 'Five-Star ratings not available.';
  }
  const C5 = {
    condition_code:       'C-5',
    condition_name:       'Five-Star Component Discrepancy',
    classification:       c5classification,
    dss_domain:           2,
    dss_domain_secondary: null,
    recognition_risk:     'Moderate',
    source_citation_type:  'CMS Five-Star',
    source_citation_value: 'Health Inspection vs Overall Rating',
    source_count:          c5count,
    description:           c5desc
  };

  // ── C-6: Staffing Profile ─────────────────────────────────────────────────
  const belowHprd    = hprd     !== null && hprd     < HPRD_BENCHMARK;
  const belowRn      = rnHprd   !== null && rnHprd   < RN_HPRD_BENCHMARK;
  const highTurnover = turnover !== null && turnover > TURNOVER_BENCHMARK;
  const staffingBelow = belowHprd || belowRn || highTurnover;
  const staffingParts = [];
  if (hprd     !== null) staffingParts.push(`${hprd} hrs/resident/day (benchmark ${HPRD_BENCHMARK})`);
  if (rnHprd   !== null) staffingParts.push(`${rnHprd} RN hrs (benchmark ${RN_HPRD_BENCHMARK})`);
  if (turnover !== null) staffingParts.push(`${turnover}% turnover (benchmark ${TURNOVER_BENCHMARK}%)`);
  const C6 = {
    condition_code:       'C-6',
    condition_name:       'Staffing Profile',
    classification:       staffingBelow ? 'Potential' : 'Not Identified',
    dss_domain:           3,
    dss_domain_secondary: 4,
    recognition_risk:     'High',
    source_citation_type:  'CMS Staffing Data',
    source_citation_value: 'HPRD / RN Hours / Turnover',
    source_count:          null,
    description: staffingParts.length ? staffingParts.join('; ') : 'Staffing data not available.'
  };

  // ── C-7: Special Focus / Enforcement ─────────────────────────────────────
  let c7classification;
  if (specialFocus || abuseFlag)      c7classification = 'Recognized';
  else if ((penaltyCount || 0) > 0)   c7classification = 'Potential';
  else                                 c7classification = 'Not Identified';
  const c7desc = specialFocus       ? 'Special Focus designation present.'
    : abuseFlag                     ? 'Abuse flag on record.'
    : (penaltyCount || 0) > 0       ? `${penaltyCount} civil monetary penalty record(s).`
    :                                  'No enforcement indicators in public record.';
  const C7 = {
    condition_code:       'C-7',
    condition_name:       'Special Focus / Enforcement History',
    classification:       c7classification,
    dss_domain:           null,
    dss_domain_secondary: null,
    recognition_risk:     null,
    source_citation_type:  'CMS Enforcement',
    source_citation_value: 'Special Focus Status / Penalties',
    source_count:          penaltyCount || 0,
    description:           c7desc
  };

  const conditions = [C1, C2, C3, C4, C5, C6, C7];

  // ── Exposure level ────────────────────────────────────────────────────────
  const active          = conditions.filter(c => c.classification !== 'Not Identified');
  const highRisk        = active.filter(c => c.recognition_risk === 'High');
  const highRecognized  = highRisk.filter(c => c.classification === 'Recognized');
  let exposureLevel;
  if      (highRecognized.length >= 2)                        exposureLevel = 'High';
  else if (highRecognized.length >= 1 || highRisk.length >= 3) exposureLevel = 'Moderate-High';
  else if (highRisk.length >= 1)                              exposureLevel = 'Moderate';
  else                                                         exposureLevel = 'Low';

  // ── Facility row ──────────────────────────────────────────────────────────
  const facilityRow = {
    name:               provider.provider_name,
    country:            'US',
    region:             provider.state,
    city:               provider.citytown || null,
    zip_code:           provider.zip_code || null,
    urban_flag:         provider.urban || null,
    latitude:           parseFloat(provider.latitude)  || null,
    longitude:          parseFloat(provider.longitude) || null,
    care_type:          'SNF',
    licensed_beds:      parseInt(provider.number_of_certified_beds) || null,
    source_system:      'CMS',
    source_facility_id: provider.cms_certification_number_ccn
  };

  // ── Assessment row ────────────────────────────────────────────────────────
  const assessmentRow = {
    assessment_id:           assessmentId,
    assessment_date:         new Date().toISOString().split('T')[0],
    market:                  null,
    exposure_level:          exposureLevel,
    overall_rating:          overall  !== null ? parseInt(overall)  : null,
    health_inspection_rating: health  !== null ? parseInt(health)   : null,
    qm_rating:               parseFloat(provider.qm_rating)      || null,
    staffing_rating:         parseFloat(provider.staffing_rating) || null,
    staffing_hprd:           hprd,
    staffing_hprd_pbj:       hprdPbj,
    rn_hprd:                 rnHprd,
    nursing_turnover_pct:    turnover,
    ownership_type:          provider.ownership_type || null,
    special_focus_flag:      specialFocus ? 1 : 0,
    abuse_flag:              abuseFlag    ? 1 : 0
  };

  return { facilityRow, assessmentRow, conditionRows: conditions, gapRows: SNF_DATA_GAPS };
}

module.exports = { classifyFacility, buildAssessmentId };
