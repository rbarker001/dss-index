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
             SUM(CASE WHEN c.dss_domain = 2       AND c.classification IN ('Recognized', 'Potential') THEN 1 ELSE 0 END) AS active_domain2
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
    description: 'Recognized / Potential / Not Identified / Not Assessed for every condition across all facilities. Not Assessed = the CMS data needed to evaluate the condition was missing (distinct from assessed-clean). Click a row to see which facilities carry that condition.',
    drilldown: {
      paramCol: 'condition_code',
      title: '{value} — active facilities',
      sql: `
        SELECT f.name, c.classification, c.source_count AS citations,
               c.dss_domain, a.exposure_level
        FROM condition c
        JOIN assessment a ON c.assessment_id = a.assessment_id
        JOIN facility f   ON a.facility_id   = f.facility_id
        WHERE c.condition_code = ? AND c.classification IN ('Recognized', 'Potential')
        ORDER BY CASE c.classification WHEN 'Recognized' THEN 1 ELSE 2 END, f.name`
    },
    sql: `
      SELECT condition_code, condition_name,
             SUM(CASE WHEN classification = 'Recognized'     THEN 1 ELSE 0 END) AS recognized,
             SUM(CASE WHEN classification = 'Potential'      THEN 1 ELSE 0 END) AS potential,
             SUM(CASE WHEN classification = 'Not Identified' THEN 1 ELSE 0 END) AS not_identified,
             SUM(CASE WHEN classification = 'Not Assessed'   THEN 1 ELSE 0 END) AS not_assessed,
             COUNT(*) AS total_facilities
      FROM condition
      GROUP BY condition_code, condition_name
      ORDER BY condition_code`
  },
  {
    id: 'dss_domain_activity_by_facility',
    category: 'Condition Analysis',
    title: 'DSS domain activity — all 4 domains with labels',
    description: 'Active conditions by DSS domain across all facilities. Includes domain names (Seizure Events, Movement Changes, Awareness Changes, Behavioral Changes). Click a row to see the facilities and conditions behind that count.',
    drilldown: {
      paramCol: 'dss_domain',
      title: 'DSS Domain {value} — active conditions',
      sql: `
        SELECT f.name, c.condition_code, c.condition_name, c.classification,
               CASE c.dss_domain WHEN 1 THEN 'Seizure Events'
                 WHEN 2 THEN 'Movement Changes'
                 WHEN 3 THEN 'Awareness Changes'
                 WHEN 4 THEN 'Behavioral Changes' END AS domain_name,
               c.recognition_risk, c.source_citation_value AS ftag, c.source_count AS citations
        FROM condition c
        JOIN assessment a ON c.assessment_id = a.assessment_id
        JOIN facility f   ON a.facility_id   = f.facility_id
        WHERE c.dss_domain = ? AND c.classification IN ('Recognized', 'Potential')
        ORDER BY CASE c.classification WHEN 'Recognized' THEN 1 ELSE 2 END, f.name`
    },
    sql: `
      SELECT dss_domain,
             CASE dss_domain WHEN 1 THEN 'Seizure Events'
               WHEN 2 THEN 'Movement Changes'
               WHEN 3 THEN 'Awareness Changes'
               WHEN 4 THEN 'Behavioral Changes' END AS domain_name,
             COUNT(*) AS total_active,
             SUM(CASE WHEN classification = 'Recognized' THEN 1 ELSE 0 END) AS recognized,
             SUM(CASE WHEN classification = 'Potential'  THEN 1 ELSE 0 END) AS potential
      FROM condition
      WHERE classification IN ('Recognized', 'Potential') AND dss_domain IS NOT NULL
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
    id: 'dss_domain2_movement_active',
    category: 'Condition Analysis',
    title: 'Domain 2 — all active Movement Changes conditions',
    description: 'Every active Domain 2 condition across all facilities. Domain 2 covers movement automatisms (oral, limb, hand), episodic stiffness, and seizure-precipitated falls — partially recognizable but inconsistently attributed in dementia populations.',
    sql: `
      SELECT f.name, c.condition_code, c.condition_name, c.classification,
             c.source_citation_value AS ftag, c.source_count AS citations, a.exposure_level,
             a.staffing_hprd, a.nursing_turnover_pct AS turnover
      FROM condition c
      JOIN assessment a ON c.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id   = f.facility_id
      WHERE c.dss_domain = 2 AND c.classification IN ('Recognized', 'Potential')
      ORDER BY CASE c.classification WHEN 'Recognized' THEN 1 ELSE 2 END,
               c.condition_code, f.name`
  },
  {
    id: 'dss_domain3_domain4_active_combined',
    category: 'Condition Analysis',
    title: 'Domain 3 + 4 combined — Awareness and Behavioral Changes',
    description: 'Every active condition mapping to Domains 3 or 4. Domain 3 (Awareness Changes: staring spells, unresponsiveness, acute confusion, transient amnesia) and Domain 4 (Behavioral Changes: sudden agitation, speech arrest, abrupt mood shifts, repetitive actions). Combined view for overview; separate domain-specific queries also available.',
    sql: `
      SELECT f.name, c.condition_code, c.condition_name, c.classification,
             CASE c.dss_domain WHEN 3 THEN 'Awareness Changes'
                               WHEN 4 THEN 'Behavioral Changes' END AS domain_name,
             c.source_citation_value AS ftag, c.source_count AS citations, a.exposure_level
      FROM condition c
      JOIN assessment a ON c.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id   = f.facility_id
      WHERE c.dss_domain IN (3, 4) AND c.classification IN ('Recognized', 'Potential')
      ORDER BY c.dss_domain,
               CASE c.classification WHEN 'Recognized' THEN 1 ELSE 2 END,
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
             SUM(CASE WHEN classification IN ('Recognized', 'Potential') THEN 1 ELSE 0 END) AS facilities_with_any,
             SUM(CASE WHEN classification = 'Recognized'      THEN 1 ELSE 0 END) AS recognized
      FROM condition
      WHERE source_citation_type = 'CMS F-tag'
      GROUP BY source_citation_value
      ORDER BY total_citations DESC`
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
      WHERE c.recognition_risk = 'High' AND c.classification IN ('Recognized', 'Potential')
      GROUP BY f.name, a.exposure_level
      ORDER BY high_risk_active DESC, f.name`
  },
  {
    id: 'dss_domain1_seizure_events_active',
    category: 'Condition Analysis',
    title: 'Domain 1 — all active Seizure Events conditions',
    description: 'Every active Domain 1 condition across all facilities. Domain 1 covers convulsive episodes, incontinence, post-ictal confusion, unexplained falls, and nocturnal episodes — the most direct seizure indicators in the DSS framework.',
    sql: `
      SELECT f.name, c.condition_code, c.condition_name, c.classification,
             c.source_citation_value AS ftag, c.source_count AS citations, a.exposure_level
      FROM condition c
      JOIN assessment a ON c.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id   = f.facility_id
      WHERE c.dss_domain = 1 AND c.classification IN ('Recognized', 'Potential')
      ORDER BY CASE c.classification WHEN 'Recognized' THEN 1 ELSE 2 END,
               c.condition_code, f.name`
  },
  {
    id: 'dss_domain3_awareness_active',
    category: 'Condition Analysis',
    title: 'Domain 3 — all active Awareness Changes conditions',
    description: 'Every active Domain 3 condition across all facilities. Domain 3 (Awareness Changes) covers staring spells, unresponsiveness, acute confusion episodes, and transient amnesia — the seizure manifestations most commonly mistaken for dementia progression.',
    sql: `
      SELECT f.name, c.condition_code, c.condition_name, c.classification,
             c.source_citation_value AS ftag, c.source_count AS citations, a.exposure_level
      FROM condition c
      JOIN assessment a ON c.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id   = f.facility_id
      WHERE c.dss_domain = 3 AND c.classification IN ('Recognized', 'Potential')
      ORDER BY CASE c.classification WHEN 'Recognized' THEN 1 ELSE 2 END,
               c.condition_code, f.name`
  },
  {
    id: 'dss_domain4_behavioral_active',
    category: 'Condition Analysis',
    title: 'Domain 4 — all active Behavioral Changes conditions',
    description: 'Every active Domain 4 condition across all facilities. Domain 4 (Behavioral Changes) covers sudden agitation/fear, speech arrest, abrupt mood shifts, and repetitive purposeless actions — ictal and post-ictal behavioral manifestations of seizures.',
    sql: `
      SELECT f.name, c.condition_code, c.condition_name, c.classification,
             c.source_citation_value AS ftag, c.source_count AS citations, a.exposure_level
      FROM condition c
      JOIN assessment a ON c.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id   = f.facility_id
      WHERE c.dss_domain = 4 AND c.classification IN ('Recognized', 'Potential')
      ORDER BY CASE c.classification WHEN 'Recognized' THEN 1 ELSE 2 END,
               c.condition_code, f.name`
  },
  {
    id: 'potential_recognized_ratio_by_domain',
    category: 'Condition Analysis',
    title: 'Potential-to-Recognized ratio by DSS domain',
    description: 'For each DSS domain, the percentage of active conditions classified as Potential vs Recognized. A high Potential share in Domains 3 and 4 supports the DSEF thesis that seizure indicators in those domains are systematically under-recognized.',
    sql: `
      SELECT dss_domain,
             CASE dss_domain WHEN 1 THEN 'Seizure Events'
               WHEN 2 THEN 'Movement Changes'
               WHEN 3 THEN 'Awareness Changes'
               WHEN 4 THEN 'Behavioral Changes' END AS domain_name,
             COUNT(*) AS total_active,
             SUM(CASE WHEN classification = 'Recognized' THEN 1 ELSE 0 END) AS recognized,
             SUM(CASE WHEN classification = 'Potential'  THEN 1 ELSE 0 END) AS potential,
             ROUND(100.0 * SUM(CASE WHEN classification = 'Potential' THEN 1 ELSE 0 END)
               / NULLIF(SUM(CASE WHEN classification IN ('Recognized', 'Potential') THEN 1 ELSE 0 END), 0), 1) AS pct_potential
      FROM condition
      WHERE classification IN ('Recognized', 'Potential') AND dss_domain IS NOT NULL
      GROUP BY dss_domain
      ORDER BY pct_potential DESC`
  },
  {
    id: 'conditions_potential_dominant',
    category: 'Condition Analysis',
    title: 'Potential-dominant conditions (Potential > Recognized)',
    description: 'Specific conditions where Potential classifications outnumber Recognized. These are the conditions where the framework is most likely under-documenting seizure activity — the condition looks seizure-like but CMS surveys rarely cite it as such.',
    sql: `
      WITH domain_totals AS (
        SELECT dss_domain, condition_code, condition_name,
               SUM(CASE WHEN classification = 'Recognized' THEN 1 ELSE 0 END) AS recognized,
               SUM(CASE WHEN classification = 'Potential'  THEN 1 ELSE 0 END) AS potential
        FROM condition
        WHERE dss_domain IS NOT NULL AND classification IN ('Recognized', 'Potential')
        GROUP BY dss_domain, condition_code, condition_name
      )
      SELECT dt.dss_domain,
             CASE dt.dss_domain WHEN 1 THEN 'Seizure Events'
               WHEN 2 THEN 'Movement Changes'
               WHEN 3 THEN 'Awareness Changes'
               WHEN 4 THEN 'Behavioral Changes' END AS domain_name,
             dt.condition_code, dt.condition_name,
             dt.recognized, dt.potential,
             ROUND(100.0 * dt.potential / NULLIF(dt.recognized + dt.potential, 0), 1) AS pct_potential
      FROM domain_totals dt
      WHERE dt.potential > dt.recognized
      ORDER BY pct_potential DESC, dt.dss_domain`
  },
  {
    id: 'facility_multidomain_overlap',
    category: 'Condition Analysis',
    title: 'Facilities with active conditions in 2+ DSS domains',
    description: 'The DSEF thesis is that seizure indicators in dementia appear across multiple DSS domains simultaneously. This query surfaces facilities with active conditions in 2 or more domains — the empirical evidence for multi-domain seizure presentation.',
    sql: `
      SELECT f.name, a.exposure_level,
             COUNT(DISTINCT c.dss_domain) AS active_domains,
             GROUP_CONCAT(DISTINCT CASE c.dss_domain
               WHEN 1 THEN 'D1-Seizure'
               WHEN 2 THEN 'D2-Movement'
               WHEN 3 THEN 'D3-Awareness'
               WHEN 4 THEN 'D4-Behavioral'
             END) AS domains_present,
             COUNT(CASE WHEN c.classification = 'Recognized' THEN 1 END) AS recognized_total,
             COUNT(CASE WHEN c.classification = 'Potential'  THEN 1 END) AS potential_total
      FROM condition c
      JOIN assessment a ON c.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id   = f.facility_id
      WHERE c.dss_domain IS NOT NULL AND c.classification IN ('Recognized', 'Potential')
      GROUP BY f.name, a.exposure_level
      HAVING active_domains >= 2
      ORDER BY active_domains DESC, recognized_total DESC`
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
  },

  // ── CITATION DETAIL ────────────────────────────────────────────────────────
  // Recency and severity visibility. Classification does not weight recency
  // (deliberate — see architecture-db.md); these queries surface it as data
  // so a reader can weigh "Recognized, last cited 2019" vs "last cited 2026".
  {
    id: 'condition_recency',
    category: 'Citation Detail',
    title: 'Recognized conditions — citation recency with stale flag',
    description: 'Every Recognized citation-based condition with citation dates, months since latest, and a stale flag (no citation in 24+ months). Sort stale-first to surface conditions most exposed to the "old citations" critique.',
    sql: `
      SELECT f.name, c.condition_code, c.source_citation_value AS ftag,
             c.source_count AS citations,
             MAX(ct.citation_date) AS latest_citation,
             CAST((julianday('now') - julianday(MAX(ct.citation_date))) / 30.44 AS INTEGER) AS months_since,
             CASE WHEN julianday('now') - julianday(MAX(ct.citation_date)) > 730 THEN 'Yes' ELSE 'No' END AS stale,
             SUM(CASE WHEN ct.inspection_cycle = 1 THEN 1 ELSE 0 END) AS cycle1_citations,
             SUM(CASE WHEN ct.severity_code IN ('G','H','I','J','K','L') THEN 1 ELSE 0 END) AS severe_citations
      FROM condition c
      JOIN assessment a ON c.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id   = f.facility_id
      JOIN citation ct  ON ct.assessment_id = a.assessment_id
                       AND ((c.condition_code = 'C-4' AND ct.source_citation_value IN ('F-740','F-741'))
                         OR ct.source_citation_value = c.source_citation_value)
      WHERE c.classification = 'Recognized' AND c.condition_code IN ('C-1','C-2','C-3','C-4')
      GROUP BY c.condition_id
      ORDER BY latest_citation ASC`
  },
  {
    id: 'severe_citations',
    category: 'Citation Detail',
    title: 'Severe citations — actual harm and immediate jeopardy',
    description: 'Every G+ severity citation in the screened tags (G–I actual harm, J–L immediate jeopardy). These single citations now classify Recognized on their own under severity weighting.',
    sql: `
      SELECT f.name, ct.source_citation_value AS ftag, ct.severity_code,
             CASE WHEN ct.severity_code IN ('J','K','L') THEN 'Immediate Jeopardy'
                  ELSE 'Actual Harm' END AS severity_class,
             ct.citation_date, ct.survey_type, a.exposure_level
      FROM citation ct
      JOIN assessment a ON ct.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id    = f.facility_id
      WHERE ct.severity_code IN ('G','H','I','J','K','L')
      ORDER BY CASE WHEN ct.severity_code IN ('J','K','L') THEN 0 ELSE 1 END,
               ct.citation_date DESC`
  },
  {
    id: 'survey_currency',
    category: 'Citation Detail',
    title: 'Survey currency — how fresh is each facility’s record',
    description: 'Latest screened citation per facility. A facility whose newest citation is from 2021 has an older public record than its peers — a data-currency caveat, not a virtue. Facilities with no screened citations are excluded (no date to measure).',
    sql: `
      SELECT f.name, COUNT(*) AS citations,
             MAX(ct.citation_date) AS latest_citation,
             MIN(ct.citation_date) AS earliest_citation,
             a.exposure_level
      FROM citation ct
      JOIN assessment a ON ct.assessment_id = a.assessment_id
      JOIN facility f   ON a.facility_id    = f.facility_id
      GROUP BY a.assessment_id
      ORDER BY latest_citation ASC`
  }

];

module.exports = QUERIES;
