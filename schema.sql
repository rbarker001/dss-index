-- ============================================================
-- SEAGULL HEALTH — DSCA DATABASE SCHEMA (SQLite)
-- Spine: DSS Framework (global). CMS = one swappable source.
-- ============================================================

CREATE TABLE IF NOT EXISTS facility (
    facility_id         INTEGER PRIMARY KEY,
    name                TEXT NOT NULL,
    country             TEXT NOT NULL DEFAULT 'US',
    region              TEXT,
    city                TEXT,
    zip_code            TEXT,
    urban_flag          TEXT,
    latitude            REAL,
    longitude           REAL,
    care_type           TEXT,
    licensed_beds       INTEGER,
    source_system       TEXT,
    source_facility_id  TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assessment (
    assessment_id               TEXT PRIMARY KEY,
    facility_id                 INTEGER NOT NULL REFERENCES facility(facility_id),
    assessment_date             TEXT NOT NULL,
    analyst                     TEXT,
    market                      TEXT,
    exposure_level              TEXT,
    dementia_census_pct         REAL,
    dementia_census_verified    INTEGER DEFAULT 0,
    -- CMS snapshot fields (nullable; leave empty for non-US facilities)
    overall_rating              INTEGER,
    health_inspection_rating    INTEGER,
    qm_rating                   INTEGER,
    staffing_rating             INTEGER,
    staffing_hprd               REAL,    -- self-reported total nurse hours/resident/day
    staffing_hprd_pbj           REAL,    -- payroll-based total (independently verified; CMS publishes total only, not RN breakdown)
    rn_hprd                     REAL,    -- self-reported RN hours/resident/day (no PBJ equivalent published)
    nursing_turnover_pct        REAL,
    ownership_type              TEXT,
    special_focus_flag          INTEGER DEFAULT 0,
    abuse_flag                  INTEGER DEFAULT 0,
    report_path                 TEXT,
    created_at                  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS condition (
    condition_id            INTEGER PRIMARY KEY,
    assessment_id           TEXT NOT NULL REFERENCES assessment(assessment_id),
    condition_code          TEXT,
    condition_name          TEXT,
    classification          TEXT NOT NULL,
    dss_domain              INTEGER,
    dss_domain_secondary    INTEGER,
    recognition_risk        TEXT,
    description             TEXT,
    source_citation_type    TEXT,
    source_citation_value   TEXT,
    source_count            INTEGER,
    created_at              TEXT DEFAULT (datetime('now'))
);

-- One row per source-record citation backing the condition counts.
-- Source-system specifics (F-tags, CMS severity letters, inspection cycles)
-- are values, not structure — a UK CQC finding fits the same columns.
CREATE TABLE IF NOT EXISTS citation (
    citation_id             INTEGER PRIMARY KEY,
    assessment_id           TEXT NOT NULL REFERENCES assessment(assessment_id),
    source_citation_type    TEXT,    -- e.g. 'CMS F-tag'
    source_citation_value   TEXT,    -- e.g. 'F-689'
    citation_date           TEXT,    -- survey date (ISO)
    severity_code           TEXT,    -- e.g. CMS scope/severity letter A-L
    survey_type             TEXT,    -- e.g. 'Health', 'Complaint'
    inspection_cycle        INTEGER, -- source-system cycle number if published
    created_at              TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS data_gap (
    gap_id              INTEGER PRIMARY KEY,
    assessment_id       TEXT NOT NULL REFERENCES assessment(assessment_id),
    gap_code            TEXT,
    materiality         TEXT,
    availability        TEXT,
    record_needed       TEXT,
    absence_implication TEXT
);

CREATE TABLE IF NOT EXISTS evidence (
    evidence_id         INTEGER PRIMARY KEY,
    assessment_id       TEXT NOT NULL REFERENCES assessment(assessment_id),
    condition_id        INTEGER REFERENCES condition(condition_id),
    claim               TEXT,
    basis_type          TEXT,
    evidence_strength   TEXT,
    source_reference    TEXT
);

CREATE TABLE IF NOT EXISTS exposure_estimate (
    estimate_id         INTEGER PRIMARY KEY,
    assessment_id       TEXT NOT NULL REFERENCES assessment(assessment_id),
    scenario            TEXT,
    resident_count      INTEGER,
    prevalence_pct      REAL,
    literature_basis    TEXT,
    basis_type          TEXT
);

CREATE INDEX IF NOT EXISTS idx_condition_assessment  ON condition(assessment_id);
CREATE INDEX IF NOT EXISTS idx_condition_domain      ON condition(dss_domain);
CREATE INDEX IF NOT EXISTS idx_assessment_facility   ON assessment(facility_id);
CREATE INDEX IF NOT EXISTS idx_gap_assessment        ON data_gap(assessment_id);
CREATE INDEX IF NOT EXISTS idx_citation_assessment   ON citation(assessment_id);
CREATE INDEX IF NOT EXISTS idx_citation_value        ON citation(source_citation_value);
CREATE INDEX IF NOT EXISTS idx_citation_date         ON citation(citation_date);
