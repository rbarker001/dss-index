// DSCA Query Library — standard analytical queries against dsca.db

const QUERIES = [

  // ── GEOGRAPHIC ───────────────────────────────────────────────────────────
  {
    id: 'cities_by_exposure',
    category: 'Geographic',
    title: 'Cities ranked by exposure',
    description: 'Every city in the database ranked by % High + Moderate-High facilities. Shows where risk concentrates geographically.',
    drilldown: {
      paramCol: 'city',
      title: '{value} — all facilities',
      sql: `
        SELECT f.name, a.exposure_level, a.staffing_hprd, a.overall_rating AS five_star,
               a.ownership_type, a.nursing_turnover_pct AS turnover
        FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
        WHERE f.city = ?
        ORDER BY CASE a.exposure_level
          WHEN 'High' THEN 1 WHEN 'Moderate-High' THEN 2
          WHEN 'Moderate' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END`
    },
    sql: `
      SELECT f.city,
             COUNT(*)                                                                AS facilities,
             SUM(CASE WHEN a.exposure_level = 'High'          THEN 1 ELSE 0 END)   AS high,
             SUM(CASE WHEN a.exposure_level = 'Moderate-High' THEN 1 ELSE 0 END)   AS moderate_high,
             SUM(CASE WHEN a.exposure_level = 'Moderate'      THEN 1 ELSE 0 END)   AS moderate,
             SUM(CASE WHEN a.exposure_level = 'Low'           THEN 1 ELSE 0 END)   AS low,
             ROUND(100.0 *
               SUM(CASE WHEN a.exposure_level IN ('High','Moderate-High') THEN 1 ELSE 0 END)
               / COUNT(*), 0)                                                        AS pct_elevated
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      GROUP BY f.city
      ORDER BY pct_elevated DESC, high DESC`
  },
  {
    id: 'city_staffing_comparison',
    category: 'Geographic',
    title: 'Staffing by city',
    description: 'Average reported and PBJ staffing hours per city. Shows whether staffing gaps are geographically concentrated.',
    drilldown: {
      paramCol: 'city',
      title: '{value} — staffing detail',
      sql: `
        SELECT f.name, a.staffing_hprd, a.staffing_hprd_pbj,
               ROUND(a.staffing_hprd - a.staffing_hprd_pbj, 3) AS pbj_gap,
               a.rn_hprd, a.nursing_turnover_pct AS turnover, a.exposure_level
        FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
        WHERE f.city = ?
        ORDER BY a.staffing_hprd ASC`
    },
    sql: `
      SELECT f.city,
             COUNT(*)                                         AS facilities,
             ROUND(AVG(a.staffing_hprd), 2)                  AS avg_reported_hprd,
             ROUND(AVG(a.staffing_hprd_pbj), 2)              AS avg_pbj_hprd,
             ROUND(AVG(a.rn_hprd), 2)                        AS avg_rn_hprd,
             ROUND(AVG(a.nursing_turnover_pct), 1)           AS avg_turnover
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      GROUP BY f.city
      ORDER BY avg_reported_hprd ASC`
  },
  {
    id: 'city_domain_distribution',
    category: 'Geographic',
    title: 'DSS domain activity by city',
    description: 'Which cities show the most Domain 3/4 activity. Where does the misattribution risk concentrate geographically?',
    sql: `
      SELECT f.city,
             COUNT(DISTINCT f.facility_id)                                                          AS facilities,
             SUM(CASE WHEN c.dss_domain IN (3,4) AND c.classification = 'Recognized' THEN 1 ELSE 0 END) AS recognized_domain34,
             SUM(CASE WHEN c.dss_domain IN (3,4) AND c.classification = 'Potential'  THEN 1 ELSE 0 END) AS potential_domain34,
             SUM(CASE WHEN c.dss_domain = 2       AND c.classification != 'Not Identified' THEN 1 ELSE 0 END) AS active_domain2
      FROM facility f
      JOIN assessment a ON f.facility_id = a.facility_id
      JOIN condition c  ON c.assessment_id = a.assessment_id
      GROUP BY f.city
      ORDER BY recognized_domain34 DESC, potential_domain34 DESC`
  },
  {
    id: 'urban_rural_exposure',
    category: 'Geographic',
    title: 'Urban vs rural exposure',
    description: 'Do rural facilities carry higher DSS exposure than urban? Uses CMS urban/rural classification.',
    drilldown: {
      paramCol: 'urban_flag',
      title: '{value} — facilities',
      sql: `
        SELECT f.name, f.city, a.exposure_level, a.staffing_hprd,
               a.nursing_turnover_pct AS turnover, a.ownership_type
        FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
        WHERE f.urban_flag = ?
        ORDER BY CASE a.exposure_level
          WHEN 'High' THEN 1 WHEN 'Moderate-High' THEN 2
          WHEN 'Moderate' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END`
    },
    sql: `
      SELECT f.urban_flag,
             COUNT(*)                                                                AS facilities,
             SUM(CASE WHEN a.exposure_level = 'High'          THEN 1 ELSE 0 END)   AS high,
             SUM(CASE WHEN a.exposure_level = 'Moderate-High' THEN 1 ELSE 0 END)   AS moderate_high,
             SUM(CASE WHEN a.exposure_level = 'Moderate'      THEN 1 ELSE 0 END)   AS moderate,
             SUM(CASE WHEN a.exposure_level = 'Low'           THEN 1 ELSE 0 END)   AS low,
             ROUND(AVG(a.staffing_hprd), 2)                                         AS avg_hprd,
             ROUND(AVG(a.nursing_turnover_pct), 1)                                  AS avg_turnover
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      WHERE f.urban_flag IS NOT NULL
      GROUP BY f.urban_flag
      ORDER BY f.urban_flag`
  },
  {
    id: 'facilities_by_city',
    category: 'Geographic',
    title: 'All facilities in a city',
    description: 'Full list of facilities in a specific city with exposure, staffing, and Five-Star.',
    params: ['city'],
    sql: `
      SELECT f.name, a.exposure_level, a.overall_rating AS five_star,
             a.staffing_hprd, a.nursing_turnover_pct AS turnover,
             a.ownership_type, a.special_focus_flag, a.abuse_flag
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      WHERE UPPER(f.city) = UPPER(?)
      ORDER BY CASE a.exposure_level
        WHEN 'High' THEN 1 WHEN 'Moderate-High' THEN 2
        WHEN 'Moderate' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END`
  },
  {
    id: 'state_comparison',
    category: 'Geographic',
    title: 'State comparison',
    description: 'Exposure distribution and average staffing by state. Meaningful once multiple states are in the database.',
    sql: `
      SELECT f.region AS state,
             COUNT(*)                                                                AS facilities,
             SUM(CASE WHEN a.exposure_level = 'High'          THEN 1 ELSE 0 END)   AS high,
             SUM(CASE WHEN a.exposure_level = 'Moderate-High' THEN 1 ELSE 0 END)   AS moderate_high,
             ROUND(AVG(a.staffing_hprd), 2)                                         AS avg_hprd,
             ROUND(AVG(a.nursing_turnover_pct), 1)                                  AS avg_turnover
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      GROUP BY f.region
      ORDER BY high DESC, moderate_high DESC`
  },

  // ── CITY OVERVIEW ────────────────────────────────────────────────────────
  {
    id: 'exposure_distribution',
    category: 'City Overview',
    title: 'Exposure distribution',
    description: 'Count of facilities at each exposure level. Click a row to see the facilities behind that number.',
    drilldown: {
      paramCol: 'exposure_level',
      title: '{value} — facilities',
      sql: `
        SELECT f.name, a.staffing_hprd, a.staffing_hprd_pbj, a.nursing_turnover_pct AS turnover,
               a.overall_rating AS five_star, a.ownership_type
        FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
        WHERE a.exposure_level = ?
        ORDER BY a.staffing_hprd ASC`
    },
    sql: `
      SELECT exposure_level, COUNT(*) AS facilities
      FROM assessment
      GROUP BY exposure_level
      ORDER BY CASE exposure_level
        WHEN 'High' THEN 1 WHEN 'Moderate-High' THEN 2
        WHEN 'Moderate' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END`
  },
  {
    id: 'full_facility_list',
    category: 'City Overview',
    title: 'Full facility list',
    description: 'Every facility with exposure level, Five-Star, staffing, and ownership.',
    sql: `
      SELECT f.name, a.exposure_level, a.overall_rating AS five_star,
             a.health_inspection_rating, a.staffing_hprd, a.rn_hprd,
             a.nursing_turnover_pct AS turnover_pct, a.ownership_type,
             a.special_focus_flag, a.abuse_flag, f.licensed_beds
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      ORDER BY CASE a.exposure_level
        WHEN 'High' THEN 1 WHEN 'Moderate-High' THEN 2
        WHEN 'Moderate' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END, f.name`
  },
  {
    id: 'avg_staffing_by_exposure',
    category: 'City Overview',
    title: 'Average staffing by exposure level',
    description: 'Does lower staffing predict higher exposure? Click a row to drill into that exposure tier.',
    drilldown: {
      paramCol: 'exposure_level',
      title: '{value} — staffing detail',
      sql: `
        SELECT f.name, a.staffing_hprd, a.staffing_hprd_pbj,
               ROUND(a.staffing_hprd - a.staffing_hprd_pbj, 3) AS pbj_gap,
               a.rn_hprd, a.nursing_turnover_pct AS turnover
        FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
        WHERE a.exposure_level = ?
        ORDER BY a.staffing_hprd ASC`
    },
    sql: `
      SELECT exposure_level,
             ROUND(AVG(staffing_hprd), 2)        AS avg_reported_hprd,
             ROUND(AVG(staffing_hprd_pbj), 2)    AS avg_pbj_hprd,
             ROUND(AVG(rn_hprd), 2)              AS avg_rn_hprd,
             ROUND(AVG(nursing_turnover_pct), 1) AS avg_turnover_pct,
             COUNT(*) AS n
      FROM assessment
      GROUP BY exposure_level
      ORDER BY CASE exposure_level
        WHEN 'High' THEN 1 WHEN 'Moderate-High' THEN 2
        WHEN 'Moderate' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END`
  },
  {
    id: 'five_star_by_exposure',
    category: 'City Overview',
    title: 'Five-Star ratings by exposure level',
    description: 'Does a lower Five-Star rating predict higher DSS exposure?',
    sql: `
      SELECT exposure_level,
             ROUND(AVG(overall_rating), 1)           AS avg_overall,
             ROUND(AVG(health_inspection_rating), 1) AS avg_health_inspection,
             COUNT(*) AS n
      FROM assessment
      GROUP BY exposure_level
      ORDER BY CASE exposure_level
        WHEN 'High' THEN 1 WHEN 'Moderate-High' THEN 2
        WHEN 'Moderate' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END`
  },

  // ── FACILITY TARGETING ───────────────────────────────────────────────────
  {
    id: 'high_exposure_facilities',
    category: 'Facility Targeting',
    title: 'High exposure facilities',
    description: 'All facilities rated High. Sorted by reported staffing (lowest first).',
    sql: `
      SELECT f.name, a.overall_rating AS five_star, a.staffing_hprd, a.staffing_hprd_pbj,
             a.nursing_turnover_pct AS turnover, a.ownership_type,
             a.special_focus_flag, a.abuse_flag
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      WHERE a.exposure_level = 'High'
      ORDER BY a.staffing_hprd ASC`
  },
  {
    id: 'priority_target_list',
    category: 'Facility Targeting',
    title: 'Priority target list (High + Moderate-High)',
    description: 'Combined shortlist for PE due diligence — facilities warranting a full DSCA.',
    sql: `
      SELECT f.name, a.exposure_level, a.overall_rating AS five_star,
             a.staffing_hprd, a.nursing_turnover_pct AS turnover, a.ownership_type
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      WHERE a.exposure_level IN ('High', 'Moderate-High')
      ORDER BY CASE a.exposure_level WHEN 'High' THEN 1 ELSE 2 END, a.staffing_hprd ASC`
  },
  {
    id: 'clean_facilities',
    category: 'Facility Targeting',
    title: 'Facilities with zero Recognized conditions',
    description: 'The clean end of the spectrum — no conditions documented as Recognized in the CMS record.',
    sql: `
      SELECT f.name, a.exposure_level, a.overall_rating AS five_star,
             a.staffing_hprd, a.ownership_type
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      WHERE NOT EXISTS (
        SELECT 1 FROM condition c
        WHERE c.assessment_id = a.assessment_id AND c.classification = 'Recognized'
      )
      ORDER BY a.exposure_level, f.name`
  },
  {
    id: 'staffing_gap_and_high_risk',
    category: 'Facility Targeting',
    title: 'Below-benchmark staffing AND active High-risk conditions',
    description: 'The highest-priority intersection: structural observational gap co-occurring with High recognition risk. These facilities have both the risk and the reduced capacity to detect it.',
    sql: `
      SELECT f.name, a.exposure_level, a.staffing_hprd, a.rn_hprd,
             COUNT(CASE WHEN c.recognition_risk = 'High' AND c.classification = 'Recognized' THEN 1 END) AS recognized_high,
             COUNT(CASE WHEN c.recognition_risk = 'High' AND c.classification = 'Potential'  THEN 1 END) AS potential_high
      FROM facility f
      JOIN assessment a ON f.facility_id = a.facility_id
      JOIN condition c  ON c.assessment_id = a.assessment_id
      WHERE (a.staffing_hprd < 3.8 OR a.rn_hprd < 0.75)
      GROUP BY f.name, a.exposure_level, a.staffing_hprd, a.rn_hprd
      HAVING recognized_high > 0 OR potential_high > 0
      ORDER BY recognized_high DESC, a.staffing_hprd ASC`
  },
  {
    id: 'special_focus_abuse',
    category: 'Facility Targeting',
    title: 'Special Focus or abuse flag',
    description: 'Highest regulatory risk. Either avoid or model a deep discount into acquisition price.',
    sql: `
      SELECT f.name, a.exposure_level,
             CASE a.special_focus_flag WHEN 1 THEN 'Yes' ELSE 'No' END AS special_focus,
             CASE a.abuse_flag         WHEN 1 THEN 'Yes' ELSE 'No' END AS abuse_flag,
             a.overall_rating AS five_star, a.staffing_hprd
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      WHERE a.special_focus_flag = 1 OR a.abuse_flag = 1
      ORDER BY a.exposure_level`
  },
  {
    id: 'below_staffing_benchmark',
    category: 'Facility Targeting',
    title: 'Below staffing benchmark',
    description: 'HPRD below 3.8 or RN hours below 0.75. Structural observational capacity gap.',
    sql: `
      SELECT f.name, a.exposure_level, a.staffing_hprd, a.staffing_hprd_pbj, a.rn_hprd,
             a.nursing_turnover_pct AS turnover
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      WHERE a.staffing_hprd < 3.8 OR a.rn_hprd < 0.75
      ORDER BY a.staffing_hprd ASC`
  },
  {
    id: 'high_turnover',
    category: 'Facility Targeting',
    title: 'High nursing turnover (> 60%)',
    description: 'Staff churn above 60% eliminates baseline familiarity with individual residents — new staff cannot detect subtle neurological change in dementia patients.',
    sql: `
      SELECT f.name, a.exposure_level, a.nursing_turnover_pct AS turnover_pct,
             a.staffing_hprd, a.overall_rating AS five_star
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      WHERE a.nursing_turnover_pct > 60
      ORDER BY a.nursing_turnover_pct DESC`
  },

  // ── CONDITION ANALYSIS ───────────────────────────────────────────────────
  {
    id: 'condition_breakdown',
    category: 'Condition Analysis',
    title: 'Condition classification breakdown — all conditions',
    description: 'Recognized / Potential / Not Identified for every condition across all facilities. Click a row to see which facilities carry that condition.',
    drilldown: {
      paramCol: 'condition_code',
      title: '{value} — active facilities',
      sql: `
        SELECT f.name, c.classification, c.source_count AS citations,
               c.dss_domain, a.exposure_level
        FROM condition c
        JOIN assessment a ON c.assessment_id = a.assessment_id
        JOIN facility f   ON a.facility_id   = f.facility_id
        WHERE c.condition_code = ? AND c.classification != 'Not Identified'
        ORDER BY CASE c.classification WHEN 'Recognized' THEN 1 ELSE 2 END, f.name`
    },
    sql: `
      SELECT condition_code, condition_name,
             SUM(CASE WHEN classification = 'Recognized'     THEN 1 ELSE 0 END) AS recognized,
             SUM(CASE WHEN classification = 'Potential'      THEN 1 ELSE 0 END) AS potential,
             SUM(CASE WHEN classification = 'Not Identified' THEN 1 ELSE 0 END) AS not_identified,
             COUNT(*) AS total_facilities
      FROM condition
      GROUP BY condition_code, condition_name
      ORDER BY condition_code`
  },
  {
    id: 'domain_distribution',
    category: 'Condition Analysis',
    title: 'DSS domain distribution — all domains',
    description: 'Active conditions by DSS domain across all facilities. All four domains shown. Click a row to see the facilities and conditions behind that count.',
    drilldown: {
      paramCol: 'dss_domain',
      title: 'DSS Domain {value} — active conditions',
      sql: `
        SELECT f.name, c.condition_code, c.condition_name, c.classification,
               c.recognition_risk, c.source_citation_value AS ftag, c.source_count AS citations
        FROM condition c
        JOIN assessment a ON c.assessment_id = a.assessment_id
        JOIN facility f   ON a.facility_id   = f.facility_id
        WHERE c.dss_domain = ? AND c.classification != 'Not Identified'
        ORDER BY CASE c.classification WHEN 'Recognized' THEN 1 ELSE 2 END, f.name`
    },
    sql: `
      SELECT dss_domain,
             COUNT(*) AS total_active,
             SUM(CASE WHEN classification = 'Recognized' THEN 1 ELSE 0 END) AS recognized,
             SUM(CASE WHEN classification = 'Potential'  THEN 1 ELSE 0 END) AS potential
      FROM condition
      WHERE classification != 'Not Identified' AND dss_domain IS NOT NULL
      GROUP BY dss_domain
      ORDER BY dss_domain`
  },
  {
    id: 'all_conditions_by_domain',
    category: 'Condition Analysis',
    title: 'All conditions × domain × classification',
    description: 'Full breakdown — every condition, every domain, every classification tier. Shows the complete picture across all four DSS domains.',
    sql: `
      SELECT c.dss_domain,
             CASE c.dss_domain WHEN 1 THEN 'Seizure Events'
               WHEN 2 THEN 'Movement Changes'
               WHEN 3 THEN 'Awareness Changes'
               WHEN 4 THEN 'Behavioral Changes' END AS domain_name,
             c.condition_code, c.condition_name, c.classification,
             COUNT(*) AS facility_count,
             SUM(COALESCE(c.source_count, 0)) AS total_citations
      FROM condition c
      WHERE c.dss_domain IS NOT NULL
      GROUP BY c.dss_domain, c.condition_code, c.condition_name, c.classification
      ORDER BY c.dss_domain,
               CASE c.classification WHEN 'Recognized' THEN 1 WHEN 'Potential' THEN 2 ELSE 3 END`
  },
  {
    id: 'domain2_fall_seizure',
    category: 'Condition Analysis',
    title: 'Domain 2 — Fall-Seizure Nexus (F-689)',
    description: 'Every facility with an active F-689 condition. Domain 2 covers movement automatisms and seizure-precipitated falls — partially recognizable but inconsistently attributed.',
    sql: `
      SELECT f.name, c.classification, c.source_count AS f689_citations,
             a.staffing_hprd, a.nursing_turnover_pct AS turnover, a.exposure_level
      FROM condition c
      JOIN assessment a ON c.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id   = f.facility_id
      WHERE c.source_citation_value = 'F-689' AND c.classification != 'Not Identified'
      ORDER BY c.source_count DESC, c.classification`
  },
  {
    id: 'active_domain34_all',
    category: 'Condition Analysis',
    title: 'Domain 3 + 4 — all active conditions (Recognized and Potential)',
    description: 'Every active condition mapping to Domains 3 or 4 — awareness changes and behavioral manifestations. Both Recognized and Potential included.',
    sql: `
      SELECT f.name, c.condition_code, c.condition_name, c.classification,
             c.source_citation_value AS ftag, c.source_count AS citations, a.exposure_level
      FROM condition c
      JOIN assessment a ON c.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id   = f.facility_id
      WHERE c.dss_domain IN (3, 4) AND c.classification != 'Not Identified'
      ORDER BY CASE c.classification WHEN 'Recognized' THEN 1 ELSE 2 END,
               c.condition_code, f.name`
  },
  {
    id: 'recognized_high_any_domain',
    category: 'Condition Analysis',
    title: 'Recognized conditions — any domain',
    description: 'Every Recognized condition across all domains and all facilities. The full picture of what the CMS record has confirmed.',
    drilldown: {
      paramCol: 'condition_code',
      title: '{value} — Recognized facilities',
      sql: `
        SELECT f.name, c.source_count AS citations, c.dss_domain, a.exposure_level,
               a.staffing_hprd, a.ownership_type
        FROM condition c
        JOIN assessment a ON c.assessment_id = a.assessment_id
        JOIN facility f   ON a.facility_id   = f.facility_id
        WHERE c.condition_code = ? AND c.classification = 'Recognized'
        ORDER BY c.source_count DESC`
    },
    sql: `
      SELECT c.condition_code, c.condition_name, c.dss_domain,
             c.recognition_risk, COUNT(*) AS facility_count,
             SUM(COALESCE(c.source_count, 0)) AS total_citations
      FROM condition c
      WHERE c.classification = 'Recognized'
      GROUP BY c.condition_code, c.condition_name, c.dss_domain, c.recognition_risk
      ORDER BY facility_count DESC`
  },
  {
    id: 'ftag_citation_totals',
    category: 'Condition Analysis',
    title: 'F-tag citation totals across all facilities',
    description: 'Total citations per F-tag across the city. Click a row to see which facilities have citations for that tag.',
    drilldown: {
      paramCol: 'ftag',
      title: '{value} — citations by facility',
      sql: `
        SELECT f.name, c.classification, c.source_count AS citations, a.exposure_level
        FROM condition c
        JOIN assessment a ON c.assessment_id = a.assessment_id
        JOIN facility f   ON a.facility_id   = f.facility_id
        WHERE c.source_citation_value = ?
        ORDER BY c.source_count DESC NULLS LAST`
    },
    sql: `
      SELECT source_citation_value AS ftag,
             SUM(COALESCE(source_count, 0)) AS total_citations,
             SUM(CASE WHEN classification != 'Not Identified' THEN 1 ELSE 0 END) AS facilities_with_any,
             SUM(CASE WHEN classification = 'Recognized'      THEN 1 ELSE 0 END) AS recognized
      FROM condition
      WHERE source_citation_type = 'CMS F-tag'
      GROUP BY source_citation_value
      ORDER BY total_citations DESC`
  },
  {
    id: 'cooccurrence_f658_f740',
    category: 'Condition Analysis',
    title: 'F-658 and F-740/741 co-occurrence',
    description: 'Tests the syndrome hypothesis: do professional standards failure and behavioral competency failure always appear together?',
    sql: `
      SELECT f.name,
             MAX(CASE WHEN c.source_citation_value = 'F-658'       THEN c.classification END) AS f658,
             MAX(CASE WHEN c.source_citation_value = 'F-740/F-741' THEN c.classification END) AS f740_741,
             a.exposure_level
      FROM condition c
      JOIN assessment a ON c.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id   = f.facility_id
      GROUP BY f.name, a.exposure_level
      ORDER BY CASE a.exposure_level
        WHEN 'High' THEN 1 WHEN 'Moderate-High' THEN 2
        WHEN 'Moderate' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END`
  },
  {
    id: 'high_risk_condition_count',
    category: 'Condition Analysis',
    title: 'High recognition risk condition count per facility',
    description: 'How many active High-risk conditions each facility carries. Drives the exposure level calculation.',
    sql: `
      SELECT f.name, a.exposure_level, COUNT(*) AS high_risk_active
      FROM condition c
      JOIN assessment a ON c.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id   = f.facility_id
      WHERE c.recognition_risk = 'High' AND c.classification != 'Not Identified'
      GROUP BY f.name, a.exposure_level
      ORDER BY high_risk_active DESC, f.name`
  },

  // ── OWNERSHIP PATTERNS ───────────────────────────────────────────────────
  {
    id: 'ownership_exposure',
    category: 'Ownership Patterns',
    title: 'Exposure distribution by ownership type',
    description: 'Do for-profit operators carry more DSS risk than non-profit? Click a row to see the facilities.',
    drilldown: {
      paramCol: 'ownership_type',
      title: '{value} — facilities',
      sql: `
        SELECT f.name, a.exposure_level, a.staffing_hprd, a.overall_rating AS five_star
        FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
        WHERE a.ownership_type = ?
        ORDER BY CASE a.exposure_level
          WHEN 'High' THEN 1 WHEN 'Moderate-High' THEN 2
          WHEN 'Moderate' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END`
    },
    sql: `
      SELECT a.ownership_type, COUNT(*) AS facilities,
             SUM(CASE WHEN a.exposure_level = 'High'          THEN 1 ELSE 0 END) AS high,
             SUM(CASE WHEN a.exposure_level = 'Moderate-High' THEN 1 ELSE 0 END) AS moderate_high,
             SUM(CASE WHEN a.exposure_level = 'Moderate'      THEN 1 ELSE 0 END) AS moderate,
             SUM(CASE WHEN a.exposure_level = 'Low'           THEN 1 ELSE 0 END) AS low,
             ROUND(AVG(a.staffing_hprd), 2) AS avg_hprd
      FROM assessment a
      GROUP BY a.ownership_type
      ORDER BY high DESC, moderate_high DESC`
  },
  {
    id: 'ownership_staffing',
    category: 'Ownership Patterns',
    title: 'Staffing by ownership type',
    description: 'Do non-profit operators staff more hours per resident day than for-profit?',
    sql: `
      SELECT a.ownership_type, COUNT(*) AS facilities,
             ROUND(AVG(a.staffing_hprd), 2)        AS avg_reported_hprd,
             ROUND(AVG(a.staffing_hprd_pbj), 2)    AS avg_pbj_hprd,
             ROUND(AVG(a.rn_hprd), 2)              AS avg_rn_hprd,
             ROUND(AVG(a.nursing_turnover_pct), 1) AS avg_turnover
      FROM assessment a
      GROUP BY a.ownership_type
      ORDER BY avg_reported_hprd DESC`
  },
  {
    id: 'ownership_domain',
    category: 'Ownership Patterns',
    title: 'Ownership type × DSS domain + staffing',
    description: 'Combined view: ownership structure, average staffing, and High-risk condition counts by DSS domain. The multi-dimensional comparison.',
    sql: `
      SELECT a.ownership_type,
             COUNT(DISTINCT a.assessment_id)                                           AS facilities,
             ROUND(AVG(a.staffing_hprd), 2)                                            AS avg_hprd,
             SUM(CASE WHEN c.dss_domain = 2 AND c.classification != 'Not Identified' THEN 1 ELSE 0 END) AS active_domain2,
             SUM(CASE WHEN c.dss_domain IN (3,4) AND c.classification = 'Recognized' THEN 1 ELSE 0 END) AS recognized_domain34,
             SUM(CASE WHEN c.dss_domain IN (3,4) AND c.classification = 'Potential'  THEN 1 ELSE 0 END) AS potential_domain34
      FROM assessment a
      JOIN facility f   ON f.facility_id   = a.facility_id
      JOIN condition c  ON c.assessment_id = a.assessment_id
      GROUP BY a.ownership_type
      ORDER BY recognized_domain34 DESC`
  },

  // ── STAFFING INTEGRITY ───────────────────────────────────────────────────
  {
    id: 'staffing_discrepancy',
    category: 'Staffing Integrity',
    title: 'Reported vs payroll-based staffing (PBJ)',
    description: 'Gap between self-reported and independently verified (payroll) staffing. A large discrepancy may indicate documentation inflation co-occurring with deficiency patterns.',
    sql: `
      SELECT f.name, a.exposure_level,
             a.staffing_hprd                                          AS reported_hprd,
             a.staffing_hprd_pbj                                      AS pbj_hprd,
             ROUND(a.staffing_hprd - a.staffing_hprd_pbj, 3)         AS discrepancy,
             ROUND((a.staffing_hprd - a.staffing_hprd_pbj)
               / NULLIF(a.staffing_hprd_pbj, 0) * 100, 1)            AS pct_over_reported
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      WHERE a.staffing_hprd IS NOT NULL AND a.staffing_hprd_pbj IS NOT NULL
      ORDER BY discrepancy DESC`
  },
  {
    id: 'staffing_discrepancy_vs_conditions',
    category: 'Staffing Integrity',
    title: 'Over-reporters with F-658 professional standards citations',
    description: 'Facilities that over-report staffing AND carry professional standards deficiencies. Tests whether documentation inflation co-occurs with F-658.',
    sql: `
      SELECT f.name, a.exposure_level,
             ROUND(a.staffing_hprd - a.staffing_hprd_pbj, 3) AS staffing_gap,
             c.classification AS f658_classification, c.source_count AS f658_citations
      FROM facility f
      JOIN assessment a ON f.facility_id = a.facility_id
      JOIN condition c  ON c.assessment_id = a.assessment_id AND c.source_citation_value = 'F-658'
      WHERE a.staffing_hprd > a.staffing_hprd_pbj
      ORDER BY staffing_gap DESC`
  },
  {
    id: 'all_staffing_fields',
    category: 'Staffing Integrity',
    title: 'All staffing fields — full picture',
    description: 'Reported total, PBJ total, RN hours, and turnover for every facility.',
    sql: `
      SELECT f.name, a.staffing_hprd AS reported_total, a.staffing_hprd_pbj AS pbj_total,
             a.rn_hprd AS reported_rn, a.nursing_turnover_pct AS turnover_pct,
             a.staffing_rating AS cms_staffing_star, a.exposure_level
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      ORDER BY a.staffing_hprd_pbj ASC`
  },

  // ── DATA GAPS ────────────────────────────────────────────────────────────
  {
    id: 'gap_summary',
    category: 'Data Gaps',
    title: 'Data gap inventory',
    description: 'All named gaps written to the database — standard set for every SNF.',
    sql: `
      SELECT gap_code, record_needed, materiality, availability, COUNT(*) AS facilities
      FROM data_gap
      GROUP BY gap_code, record_needed, materiality, availability
      ORDER BY gap_code`
  },

  // ── SINGLE FACILITY ──────────────────────────────────────────────────────
  {
    id: 'facility_profile',
    category: 'Single Facility',
    title: 'Assessment snapshot',
    description: 'CMS snapshot, exposure level, and staffing metrics for a specific facility.',
    params: ['facility'],
    sql: `
      SELECT f.name, a.assessment_id, a.assessment_date, a.exposure_level,
             a.overall_rating AS five_star_overall, a.health_inspection_rating,
             a.qm_rating, a.staffing_rating, a.staffing_hprd, a.staffing_hprd_pbj,
             ROUND(a.staffing_hprd - a.staffing_hprd_pbj, 3) AS staffing_pbj_gap,
             a.rn_hprd, a.nursing_turnover_pct AS turnover,
             a.ownership_type,
             CASE a.special_focus_flag WHEN 1 THEN 'Yes' ELSE 'No' END AS special_focus,
             CASE a.abuse_flag         WHEN 1 THEN 'Yes' ELSE 'No' END AS abuse_flag,
             f.licensed_beds
      FROM facility f JOIN assessment a ON f.facility_id = a.facility_id
      WHERE f.name = ?`
  },
  {
    id: 'facility_conditions',
    category: 'Single Facility',
    title: 'Full condition profile',
    description: 'All 7 conditions classified for a specific facility.',
    params: ['facility'],
    sql: `
      SELECT c.condition_code, c.condition_name, c.classification,
             c.dss_domain, c.dss_domain_secondary, c.recognition_risk,
             c.source_citation_value AS ftag, c.source_count AS citations, c.description
      FROM condition c
      JOIN assessment a ON c.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id   = f.facility_id
      WHERE f.name = ?
      ORDER BY c.condition_code`
  },
  {
    id: 'facility_gaps',
    category: 'Single Facility',
    title: 'Data gaps',
    description: 'Named data gaps for a specific facility and what their absence means.',
    params: ['facility'],
    sql: `
      SELECT dg.gap_code, dg.record_needed, dg.materiality, dg.availability, dg.absence_implication
      FROM data_gap dg
      JOIN assessment a ON dg.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id    = f.facility_id
      WHERE f.name = ?
      ORDER BY dg.gap_code`
  }

];

module.exports = QUERIES;
