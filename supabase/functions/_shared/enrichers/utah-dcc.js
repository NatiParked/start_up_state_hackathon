/**
 * Shared enricher: Utah Division of Corporations & Commercial Code (DCC) registry lookup.
 */

const BES_URL = 'https://secure.utah.gov/bes/index.html';

export async function enrichFromUtahDcc(name) {
  try {
    if (!name || typeof name !== 'string' || name.trim() === '') return {};
    const trimmedName = name.trim();
    const body = new URLSearchParams({ queryType: 'name', registeredAgentName: '', entityName: trimmedName, status: '', filingType: '' }).toString();
    let response;
    try {
      response = await fetch(BES_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'goed-hackathon/1.0' }, body });
    } catch (_fetchErr) { return {}; }
    if (!response.ok) return {};
    let html;
    try { html = await response.text(); } catch (_textErr) { return {}; }
    if (!html || html.trim() === '') return {};
    return parseUtahDccHtml(html, trimmedName);
  } catch (_outerErr) { return {}; }
}

function parseUtahDccHtml(html, searchName) {
  try {
    const nameLower = searchName.toLowerCase();
    const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [];
    let trMatch;
    while ((trMatch = trPattern.exec(html)) !== null) {
      const rowHtml = trMatch[1];
      const cells = [];
      let tdMatch;
      const localTdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      while ((tdMatch = localTdPattern.exec(rowHtml)) !== null) {
        cells.push(stripHtml(tdMatch[1]).trim());
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length === 0) return {};
    let matchedRow = null;
    let matchedRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0) continue;
      const entityName = row[0].toLowerCase();
      if (entityName === nameLower || entityName.includes(nameLower) || nameLower.includes(entityName)) {
        if (entityName === nameLower) { matchedRow = row; matchedRowIndex = i; break; }
        if (matchedRow === null) { matchedRow = row; matchedRowIndex = i; }
      }
    }
    if (!matchedRow) return {};
    const result = {};
    if (matchedRow.length > 2 && matchedRow[2]) result.entity_type = matchedRow[2];
    if (matchedRow.length > 3 && matchedRow[3]) result.status = matchedRow[3];
    if (matchedRow.length > 4 && matchedRow[4]) result.registration_date = matchedRow[4];
    const officers = [];
    const officerLabelPattern = /^(registered agent|agent|officer|director|manager|member|organizer|president|vice president|secretary|treasurer)\b/i;
    for (let i = matchedRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0) continue;
      if (row.length >= 4 && /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/.test(row[row.length - 1])) break;
      const rowText = row.join(' ');
      if (officerLabelPattern.test(rowText)) {
        for (const cell of row) {
          const cellLower = cell.toLowerCase();
          if (cell.length > 2 && !officerLabelPattern.test(cell) && !/^[\d\/\-\s]+$/.test(cell) && cellLower !== 'name' && cellLower !== 'title' && cellLower !== 'address') {
            officers.push(cell);
          }
        }
      }
    }
    result.officers = officers.length > 0 ? [...new Set(officers)] : [];
    if (!result.entity_type && !result.status && !result.registration_date) return {};
    return result;
  } catch (_parseErr) { return {}; }
}

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
