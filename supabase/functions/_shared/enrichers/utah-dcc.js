/**
 * Shared enricher: Utah Division of Corporations & Commercial Code (DCC) registry lookup.
 *
 * POSTs to the Utah Business Entity Search (BES) form at secure.utah.gov and parses
 * the returned HTML table to find a matching entity by name.
 *
 * Usage:
 *   import { enrichFromUtahDcc } from '../_shared/enrichers/utah-dcc.js'
 *   const result = await enrichFromUtahDcc('Zonos')
 *   // => { entity_type: 'LLC', status: 'Active', registration_date: '2010-01-15', officers: ['Jane Doe'] }
 *   // => {} on no match, empty input, or any error
 */

const BES_URL = 'https://secure.utah.gov/bes/index.html';

/**
 * Look up a company name in the Utah Division of Corporations & Commercial Code registry.
 *
 * POSTs to the BES name-search endpoint, parses the HTML results table using regex-based
 * extraction (no external DOM dependencies), and returns structured entity data for the
 * first row whose entity name matches the input (case-insensitive).
 *
 * @param {string} name - Company name to search for (e.g. 'Zonos' or 'Zonos LLC')
 * @returns {Promise<{
 *   entity_type?: string,
 *   status?: string,
 *   registration_date?: string,
 *   officers?: string[]
 * }>} Parsed entity data, or {} for empty/null input, no match, network error, or parse failure.
 * @throws never — all errors are caught internally
 */
export async function enrichFromUtahDcc(name) {
  try {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return {};
    }

    const trimmedName = name.trim();

    // Build form-encoded POST body as specified
    const body = new URLSearchParams({
      queryType: 'name',
      registeredAgentName: '',
      entityName: trimmedName,
      status: '',
      filingType: '',
    }).toString();

    let response;
    try {
      response = await fetch(BES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'goed-hackathon/1.0',
        },
        body,
      });
    } catch (_fetchErr) {
      return {};
    }

    if (!response.ok) {
      return {};
    }

    let html;
    try {
      html = await response.text();
    } catch (_textErr) {
      return {};
    }

    if (!html || html.trim() === '') {
      return {};
    }

    return parseUtahDccHtml(html, trimmedName);
  } catch (_outerErr) {
    return {};
  }
}

/**
 * Parse the BES results HTML to find a matching entity row and extract fields.
 *
 * The BES results page renders a table with columns:
 *   Entity Name | Entity Number | Entity Type | Status | Registration Date
 * followed by officer/agent information in sub-rows.
 *
 * @param {string} html - Raw HTML string from the BES endpoint
 * @param {string} searchName - The original search name for case-insensitive matching
 * @returns {{ entity_type?: string, status?: string, registration_date?: string, officers?: string[] }}
 */
function parseUtahDccHtml(html, searchName) {
  try {
    const nameLower = searchName.toLowerCase();

    // Extract all <tr> blocks from the HTML
    // We look for table rows containing entity data
    const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    const rows = [];
    let trMatch;
    while ((trMatch = trPattern.exec(html)) !== null) {
      const rowHtml = trMatch[1];
      const cells = [];
      let tdMatch;
      const localTdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      while ((tdMatch = localTdPattern.exec(rowHtml)) !== null) {
        // Strip HTML tags and decode basic entities from cell content
        const cellText = stripHtml(tdMatch[1]).trim();
        cells.push(cellText);
      }
      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length === 0) {
      return {};
    }

    // Find the row where the first cell (entity name) matches our search term
    // BES typically returns the entity name in the first column
    let matchedRow = null;
    let matchedRowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0) continue;

      const entityName = row[0].toLowerCase();
      // Case-insensitive substring or exact match
      if (entityName === nameLower || entityName.includes(nameLower) || nameLower.includes(entityName)) {
        // Prefer exact match, but accept substring match if no exact match found
        if (entityName === nameLower) {
          matchedRow = row;
          matchedRowIndex = i;
          break;
        }
        if (matchedRow === null) {
          matchedRow = row;
          matchedRowIndex = i;
        }
      }
    }

    if (!matchedRow) {
      return {};
    }

    // BES result table columns (0-indexed):
    // 0: Entity Name
    // 1: Entity Number (skip)
    // 2: Entity Type
    // 3: Status
    // 4: Registration Date
    // Additional columns may vary by response
    const result = {};

    if (matchedRow.length > 2 && matchedRow[2]) {
      result.entity_type = matchedRow[2] || undefined;
    }
    if (matchedRow.length > 3 && matchedRow[3]) {
      result.status = matchedRow[3] || undefined;
    }
    if (matchedRow.length > 4 && matchedRow[4]) {
      result.registration_date = matchedRow[4] || undefined;
    }

    // Extract officer names from subsequent rows until we hit another entity row
    // Officers typically appear in rows following the entity row with labels like
    // "Agent", "Officer", "Director", "Manager", etc.
    const officers = [];
    const officerLabelPattern = /^(registered agent|agent|officer|director|manager|member|organizer|president|vice president|secretary|treasurer)\b/i;

    for (let i = matchedRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0) continue;

      // If we hit a row that looks like another entity (has 5+ cells with a date-like value), stop
      if (row.length >= 4 && /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/.test(row[row.length - 1])) {
        // This looks like another entity row — stop scanning for officers
        break;
      }

      // Look for officer/agent entries — rows that contain a person name and a role label
      const rowText = row.join(' ');
      if (officerLabelPattern.test(rowText)) {
        // Extract person names: look for cells that aren't the role label itself
        for (const cell of row) {
          const cellLower = cell.toLowerCase();
          if (
            cell.length > 2 &&
            !officerLabelPattern.test(cell) &&
            !/^[\d\/\-\s]+$/.test(cell) && // skip date-only cells
            cellLower !== 'name' &&
            cellLower !== 'title' &&
            cellLower !== 'address'
          ) {
            officers.push(cell);
          }
        }
      }
    }

    if (officers.length > 0) {
      result.officers = [...new Set(officers)]; // deduplicate
    } else {
      result.officers = [];
    }

    // Return {} if we got no useful fields
    if (!result.entity_type && !result.status && !result.registration_date) {
      return {};
    }

    return result;
  } catch (_parseErr) {
    return {};
  }
}

/**
 * Strip HTML tags from a string and decode common HTML entities.
 *
 * @param {string} str - Raw HTML string
 * @returns {string} Plain text with tags removed and entities decoded
 */
function stripHtml(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
