// Generates demo-output.html from dummy data — node demo-html.js

const fs = require('fs');
const { classifyFacility, buildAssessmentId } = require('./services/classifier');

const DUMMY_PROVIDERS = [
  {
    cms_certification_number_ccn: '265399',
    provider_name: 'Maplewood Skilled Nursing & Rehabilitation',
    state: 'MO', number_of_certified_beds: '60',
    overall_rating: '3', health_inspection_rating: '2', qm_rating: '4', staffing_rating: '3',
    reported_total_nurse_staffing_hours_per_resident_per_day: '3.4',
    reported_rn_staffing_hours_per_resident_per_day: '0.62',
    total_nursing_staff_turnover: '68',
    ownership_type: 'For profit - Limited Liability company',
    special_focus_status: 'Not a Candidate', abuse_icon: 'N'
  },
  {
    cms_certification_number_ccn: '265401',
    provider_name: 'Riverside Care Center',
    state: 'MO', number_of_certified_beds: '120',
    overall_rating: '5', health_inspection_rating: '5', qm_rating: '5', staffing_rating: '4',
    reported_total_nurse_staffing_hours_per_resident_per_day: '4.1',
    reported_rn_staffing_hours_per_resident_per_day: '0.82',
    total_nursing_staff_turnover: '38',
    ownership_type: 'Non profit - Corporation',
    special_focus_status: 'Not a Candidate', abuse_icon: 'N'
  },
  {
    cms_certification_number_ccn: '265412',
    provider_name: 'Westview Nursing Home',
    state: 'MO', number_of_certified_beds: '90',
    overall_rating: '2', health_inspection_rating: '1', qm_rating: '3', staffing_rating: '2',
    reported_total_nurse_staffing_hours_per_resident_per_day: '3.1',
    reported_rn_staffing_hours_per_resident_per_day: '0.55',
    total_nursing_staff_turnover: '82',
    ownership_type: 'For profit - Corporation',
    special_focus_status: 'Special Focus Facility', abuse_icon: 'N'
  },
  {
    cms_certification_number_ccn: '265388',
    provider_name: 'Prairie Village SNF',
    state: 'MO', number_of_certified_beds: '45',
    overall_rating: '4', health_inspection_rating: '4', qm_rating: '4', staffing_rating: '3',
    reported_total_nurse_staffing_hours_per_resident_per_day: '3.6',
    reported_rn_staffing_hours_per_resident_per_day: '0.71',
    total_nursing_staff_turnover: '55',
    ownership_type: 'For profit - Individual',
    special_focus_status: 'Not a Candidate', abuse_icon: 'N'
  },
  {
    cms_certification_number_ccn: '265455',
    provider_name: 'Crossroads Rehabilitation & Living',
    state: 'MO', number_of_certified_beds: '200',
    overall_rating: '1', health_inspection_rating: '1', qm_rating: '2', staffing_rating: '1',
    reported_total_nurse_staffing_hours_per_resident_per_day: '2.8',
    reported_rn_staffing_hours_per_resident_per_day: '0.41',
    total_nursing_staff_turnover: '91',
    ownership_type: 'For profit - Corporation',
    special_focus_status: 'Special Focus Candidate', abuse_icon: 'Y'
  }
];

const DUMMY_FTAGS = {
  '265399': { '0689': 3, '0755': 1, '0658': 2, '0740': 1, '0741': 0 },
  '265401': { '0689': 0, '0755': 0, '0658': 0, '0740': 0, '0741': 0 },
  '265412': { '0689': 5, '0755': 3, '0658': 4, '0740': 2, '0741': 1 },
  '265388': { '0689': 1, '0755': 0, '0658': 1, '0740': 0, '0741': 0 },
  '265455': { '0689': 7, '0755': 4, '0658': 6, '0740': 3, '0741': 2 }
};

const DUMMY_PENALTIES = { '265399': 0, '265401': 0, '265412': 3, '265388': 0, '265455': 8 };

const EXPOSURE_COLORS = {
  'High':          { bg: '#C53030', text: '#fff' },
  'Moderate-High': { bg: '#C05621', text: '#fff' },
  'Moderate':      { bg: '#744210', text: '#fff' },
  'Low':           { bg: '#22543D', text: '#fff' }
};

const CLASS_COLORS = {
  'Recognized':    { bg: '#FED7D7', text: '#C53030', border: '#FC8181' },
  'Potential':     { bg: '#FEFCBF', text: '#744210', border: '#F6E05E' },
  'Not Identified':{ bg: '#C6F6D5', text: '#22543D', border: '#68D391' }
};

const RISK_COLORS = {
  'High':    { bg: '#FED7D7', text: '#C53030', border: '#FC8181' },
  'Moderate':{ bg: '#FEFCBF', text: '#744210', border: '#F6E05E' },
  'Low':     { bg: '#C6F6D5', text: '#22543D', border: '#68D391' }
};

function badge(label, colors) {
  if (!label) return '<span style="color:#A0AEC0;">—</span>';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:700;background:${colors.bg};color:${colors.text};border:1px solid ${colors.border || colors.bg}">${label}</span>`;
}

function exposureBadge(level) {
  const c = EXPOSURE_COLORS[level] || { bg: '#4A5568', text: '#fff' };
  return `<span style="display:inline-block;padding:3px 12px;border-radius:3px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;background:${c.bg};color:${c.text}">${level}</span>`;
}

function stars(n) {
  return n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—';
}

function main() {
  const results = DUMMY_PROVIDERS.map(p => {
    const ccn = p.cms_certification_number_ccn;
    const id  = buildAssessmentId('MO', ccn);
    return classifyFacility(id, p, DUMMY_FTAGS[ccn], DUMMY_PENALTIES[ccn]);
  });

  // Summary rows HTML
  const summaryRows = results.map(({ facilityRow, assessmentRow, conditionRows }) => {
    const recognized = conditionRows.filter(c => c.classification === 'Recognized').length;
    const potential  = conditionRows.filter(c => c.classification === 'Potential').length;
    const highRisk   = conditionRows.filter(c => c.recognition_risk === 'High' && c.classification !== 'Not Identified').length;
    return `
      <tr>
        <td style="font-weight:600;color:#1B2A4A">${facilityRow.name}</td>
        <td style="text-align:center">${assessmentRow.licensed_beds || facilityRow.licensed_beds || '—'}</td>
        <td style="text-align:center">${stars(assessmentRow.overall_rating)}</td>
        <td style="text-align:center">${assessmentRow.staffing_hprd || '—'}</td>
        <td style="text-align:center">${assessmentRow.nursing_turnover_pct ? assessmentRow.nursing_turnover_pct + '%' : '—'}</td>
        <td style="text-align:center"><b>${recognized}</b> Rec / <b>${potential}</b> Pot</td>
        <td style="text-align:center">${highRisk} of 6</td>
        <td style="text-align:center">${exposureBadge(assessmentRow.exposure_level)}</td>
      </tr>`;
  }).join('');

  // Condition grid HTML
  const conditionGrids = results.map(({ facilityRow, assessmentRow, conditionRows }) => {
    const rows = conditionRows.map(c => `
      <tr>
        <td style="font-family:monospace;font-size:11px;color:#2C5282;font-weight:700">${c.condition_code}</td>
        <td style="font-weight:500">${c.condition_name}</td>
        <td style="text-align:center">${badge(c.classification, CLASS_COLORS[c.classification] || {bg:'#EDF2F7',text:'#4A5568',border:'#CBD5E0'})}</td>
        <td style="text-align:center;font-size:12px;color:#2C5282">${c.dss_domain ? c.dss_domain + (c.dss_domain_secondary ? ' + ' + c.dss_domain_secondary : '') : '—'}</td>
        <td style="text-align:center">${c.recognition_risk ? badge(c.recognition_risk, RISK_COLORS[c.recognition_risk]) : '<span style="color:#A0AEC0">—</span>'}</td>
        <td style="text-align:center;font-family:monospace;font-size:11px;color:#2C5282;font-weight:700">${c.source_citation_value || '—'}</td>
        <td style="text-align:center;color:#718096">${c.source_count !== null ? c.source_count : '—'}</td>
      </tr>`).join('');

    return `
      <div style="margin-bottom:32px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <div style="font-size:14px;font-weight:700;color:#1B2A4A">${facilityRow.name}</div>
          ${exposureBadge(assessmentRow.exposure_level)}
          <div style="font-size:12px;color:#718096">CCN ${DUMMY_PROVIDERS.find(p => p.provider_name === facilityRow.name)?.cms_certification_number_ccn} · ${facilityRow.licensed_beds} beds · ${assessmentRow.ownership_type || '—'}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead>
            <tr style="background:#2D3748;color:#fff">
              <th style="padding:6px 10px;text-align:left;width:40px">ID</th>
              <th style="padding:6px 10px;text-align:left">Condition</th>
              <th style="padding:6px 10px;text-align:center;width:130px">Classification</th>
              <th style="padding:6px 10px;text-align:center;width:90px">DSS Domain</th>
              <th style="padding:6px 10px;text-align:center;width:100px">Risk</th>
              <th style="padding:6px 10px;text-align:center;width:90px">F-tag</th>
              <th style="padding:6px 10px;text-align:center;width:70px">Count</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:10px;font-size:12px;color:#718096;padding:8px 12px;background:#F7FAFC;border:1px solid #E2E8F0;border-radius:3px">
          <strong style="color:#4A5568">Data gaps written to DB (DG-1–DG-5):</strong>
          Pharmacy Records (Recognized) · MDS &amp; Clinical Records (Recognized) · Seizure Protocols (Recognized) · State Licensing (Potential) · Pending Enforcement (Potential)
        </div>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DSCA City Run — Kansas City, MO (Demo)</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
         font-size: 14px; line-height: 1.6; color: #2D3748; background: #F7FAFC; }
  .page { max-width: 1000px; margin: 0 auto; background: #fff; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
  .header { background: #1B2A4A; color: #fff; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
  .brand { font-size: 15px; font-weight: 500; }
  .brand span { color: #ef7835; }
  .meta { font-size: 11px; color: #90CDF4; text-align: right; line-height: 1.8; }
  .demo-badge { display:inline-block; background:#2C5282; color:#BEE3F8; font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; padding:2px 8px; border-radius:3px; }
  .title-block { padding: 24px 40px 20px; border-bottom: 2px solid #1B2A4A; }
  .title-main { font-size: 20px; font-weight: 700; color: #1B2A4A; margin-bottom: 4px; }
  .title-sub { font-size: 13px; color: #4A5568; }
  .body { padding: 32px 40px; }
  .section-header { background: #1B2A4A; color: #fff; padding: 8px 16px; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; border-radius: 3px; margin-bottom: 16px; }
  .section { margin-bottom: 40px; }
  table.summary { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.summary th { background: #2D3748; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  table.summary td { padding: 8px 10px; border-bottom: 1px solid #E2E8F0; vertical-align: middle; }
  table.summary tr:last-child td { border-bottom: none; }
  table.summary tr:nth-child(even) td { background: #F7FAFC; }
  .stat-row { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat { background: #EDF2F7; border: 1px solid #CBD5E0; border-radius: 6px; padding: 14px 20px; flex: 1; min-width: 140px; text-align: center; }
  .stat-num { font-size: 28px; font-weight: 800; color: #1B2A4A; }
  .stat-label { font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }
  .footer { background: #1B2A4A; color: #90CDF4; padding: 16px 40px; font-size: 11px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="brand">Seagull Health &nbsp;<span>|</span>&nbsp; <span>CRISP</span></div>
    <div class="meta">
      Run Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      &nbsp;&nbsp; City: Kansas City, MO &nbsp;&nbsp; Facilities: ${DUMMY_PROVIDERS.length}<br>
      <span class="demo-badge">Demo — Dummy Data</span>
    </div>
  </div>

  <div class="title-block">
    <div class="title-main">DSCA City Run — Kansas City, MO</div>
    <div class="title-sub">Deterministic DSS classification · CMS public data · SNF universe · Senior Care Investment</div>
  </div>

  <div class="body">

    <div class="section">
      <div class="section-header">City Summary</div>
      <div class="stat-row">
        <div class="stat"><div class="stat-num">${DUMMY_PROVIDERS.length}</div><div class="stat-label">Facilities</div></div>
        <div class="stat"><div class="stat-num" style="color:#C53030">${results.filter(r => r.assessmentRow.exposure_level === 'High').length}</div><div class="stat-label">High Exposure</div></div>
        <div class="stat"><div class="stat-num" style="color:#C05621">${results.filter(r => r.assessmentRow.exposure_level === 'Moderate-High').length}</div><div class="stat-label">Moderate-High</div></div>
        <div class="stat"><div class="stat-num" style="color:#744210">${results.filter(r => r.assessmentRow.exposure_level === 'Moderate').length}</div><div class="stat-label">Moderate</div></div>
        <div class="stat"><div class="stat-num" style="color:#22543D">${results.filter(r => r.assessmentRow.exposure_level === 'Low').length}</div><div class="stat-label">Low</div></div>
      </div>

      <table class="summary">
        <thead>
          <tr>
            <th>Facility</th>
            <th style="text-align:center">Beds</th>
            <th style="text-align:center">Five-Star</th>
            <th style="text-align:center">HPRD</th>
            <th style="text-align:center">Turnover</th>
            <th style="text-align:center">Conditions</th>
            <th style="text-align:center">High Risk</th>
            <th style="text-align:center">Exposure</th>
          </tr>
        </thead>
        <tbody>${summaryRows}</tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-header">Condition Breakdown — All Facilities</div>
      ${conditionGrids}
    </div>

  </div>

  <div class="footer">
    <div>CRISP — Cognitive Research Intelligence of Seizure Pathology · Seagull Health</div>
    <div>Demo output — fictitious facility data</div>
  </div>

</div>
</body>
</html>`;

  fs.writeFileSync('demo-output.html', html);
  console.log('Written: demo-output.html');
}

main();
