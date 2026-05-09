/**
 * @fileoverview One-time seed import for the `map_startups` Supabase table.
 *
 * @description
 * Fetches the published Utah GOED startup companies Google Sheet as CSV,
 * parses each row, geocodes the address via Nominatim, derives a Utah region
 * from the lat/lng bounding boxes, builds a logo.dev URL, and batch-inserts
 * all rows into `map_startups`.
 *
 * @usage
 * Run from inside the `goed/` directory:
 *   node scripts/import-seed-companies.js
 *
 * @requires {file} goed/.env.local - Must contain:
 *   - VITE_SUPABASE_URL        (Supabase project URL)
 *   - SUPABASE_SERVICE_ROLE_KEY (preferred — bypasses RLS)
 *     OR VITE_SUPABASE_ANON_KEY (fallback — requires INSERT policy)
 *   - VITE_LOGO_DEV_TOKEN      (logo.dev public token)
 *
 * @sideEffects
 * - Truncates and reloads `map_startups` (idempotent via truncate-and-reload).
 * - Appends per-row warnings for geocode / insert failures to
 *   `goed/scripts/import-warnings.log`.
 *
 * @note
 * This script contains exactly ONE `console.log` call — the final summary line.
 * All other output goes to `goed/scripts/import-warnings.log` via `appendWarning()`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHEET_ID = '1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk'

/** @type {Array<{name: string, latMin: number, latMax: number, lngMin: number, lngMax: number}>} */
const UTAH_REGIONS = [
  { name: 'Salt Lake City metro', latMin: 40.4, latMax: 41.0, lngMin: -112.3, lngMax: -111.7 },
  { name: 'Utah Valley',          latMin: 39.9, latMax: 40.4, lngMin: -112.1, lngMax: -111.6 },
  { name: 'Ogden/Weber',          latMin: 41.0, latMax: 41.5, lngMin: -112.3, lngMax: -111.8 },
  { name: 'St. George',           latMin: 37.0, latMax: 37.5, lngMin: -114.0, lngMax: -113.3 },
  { name: 'Cache Valley',         latMin: 41.5, latMax: 42.0, lngMin: -112.0, lngMax: -111.5 },
]

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Appends a timestamped warning line to the import-warnings.log file.
 *
 * @param {string} message - Warning message to append.
 * @returns {void}
 */
const appendWarning = (message) => {
  const logPath = path.join(__dirname, 'import-warnings.log')
  const line = `[${new Date().toISOString()}] ${message}\n`
  fs.appendFileSync(logPath, line, 'utf8')
}

/**
 * Returns a Promise that resolves after the given number of milliseconds.
 *
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/**
 * Reads `goed/.env.local` from disk and parses it into a plain key/value object.
 * Ignores blank lines and lines starting with `#`.
 *
 * @returns {Record<string, string>} Parsed environment variables.
 * @throws {Error} If the file does not exist.
 */
const loadEnv = () => {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing required env file: ${envPath}`)
  }
  const raw = fs.readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    env[key] = value
  }
  return env
}

// ---------------------------------------------------------------------------
// CSV fetch & parse
// ---------------------------------------------------------------------------

/**
 * Fetches the published Google Sheet as CSV text.
 *
 * @returns {Promise<string>} Raw CSV text.
 * @throws {Error} If the HTTP response is not 2xx.
 */
const fetchSheetCsv = async () => {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch sheet CSV: HTTP ${res.status} ${res.statusText}`)
  }
  return res.text()
}

/**
 * Hand-rolled CSV parser that handles quoted fields containing commas and newlines.
 * Returns an array of row objects keyed by the normalized header names.
 *
 * @param {string} text - Raw CSV text.
 * @returns {Array<Record<string, string>>} Parsed rows.
 */
const parseCsv = (text) => {
  // Tokenise into fields, respecting RFC 4180 quoting
  const tokenise = (src) => {
    const rows = []
    let row = []
    let field = ''
    let inQuotes = false
    let i = 0

    while (i < src.length) {
      const ch = src[i]

      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') {
            // Escaped quote
            field += '"'
            i += 2
          } else {
            inQuotes = false
            i++
          }
        } else {
          field += ch
          i++
        }
      } else {
        if (ch === '"') {
          inQuotes = true
          i++
        } else if (ch === ',') {
          row.push(field)
          field = ''
          i++
        } else if (ch === '\r' && src[i + 1] === '\n') {
          row.push(field)
          rows.push(row)
          row = []
          field = ''
          i += 2
        } else if (ch === '\n') {
          row.push(field)
          rows.push(row)
          row = []
          field = ''
          i++
        } else {
          field += ch
          i++
        }
      }
    }

    // Last field / row
    if (field || row.length > 0) {
      row.push(field)
      rows.push(row)
    }

    return rows
  }

  const allRows = tokenise(text)
  if (allRows.length === 0) return []

  // Normalize headers (trim whitespace)
  const headers = allRows[0].map((h) => h.trim())

  return allRows.slice(1).map((cols) => {
    const obj = {}
    headers.forEach((header, idx) => {
      obj[header] = (cols[idx] ?? '').trim()
    })
    return obj
  })
}

// ---------------------------------------------------------------------------
// Geocoding & region
// ---------------------------------------------------------------------------

/**
 * Derives the Utah region name from a lat/lng coordinate pair using
 * hard-coded bounding boxes. Returns `null` if either coordinate is null.
 *
 * @param {number|null} lat - Latitude.
 * @param {number|null} lng - Longitude.
 * @returns {string|null} Region name or `null`.
 */
const deriveRegion = (lat, lng) => {
  if (lat == null || lng == null) return null
  for (const region of UTAH_REGIONS) {
    if (
      lat >= region.latMin && lat <= region.latMax &&
      lng >= region.lngMin && lng <= region.lngMax
    ) {
      return region.name
    }
  }
  return 'Other Utah'
}

/**
 * Geocodes a free-text address via Nominatim (OpenStreetMap).
 * Honors a 1 req/sec rate limit by the caller (sleep between calls).
 * Never throws — returns `{ lat: null, lng: null }` on any failure.
 *
 * @param {string} address - Address string to geocode.
 * @returns {Promise<{lat: number|null, lng: number|null}>}
 */
const geocodeAddress = async (address) => {
  if (!address) {
    appendWarning(`geocodeAddress: empty address provided`)
    return { lat: null, lng: null }
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'goed-hackathon' },
    })

    if (!res.ok) {
      appendWarning(`geocodeAddress HTTP ${res.status} for address: ${address}`)
      return { lat: null, lng: null }
    }

    const json = await res.json()

    if (!json || json.length === 0) {
      appendWarning(`geocodeAddress: no result for address: ${address}`)
      return { lat: null, lng: null }
    }

    return {
      lat: parseFloat(json[0].lat),
      lng: parseFloat(json[0].lon),
    }
  } catch (err) {
    appendWarning(`geocodeAddress exception for address "${address}": ${err.message}`)
    return { lat: null, lng: null }
  }
}

// ---------------------------------------------------------------------------
// Logo URL
// ---------------------------------------------------------------------------

/**
 * Extracts a bare domain from a website URL.
 * Strips protocol, `www.`, and any path/query/hash suffix.
 *
 * @param {string} websiteUrl - Raw website URL from the sheet.
 * @returns {string|null} Bare domain (e.g. `example.com`) or `null` if invalid/empty.
 */
const extractDomain = (websiteUrl) => {
  if (!websiteUrl) return null
  let s = websiteUrl.trim().toLowerCase()
  if (!s) return null
  s = s.replace(/^https?:\/\//, '')
  s = s.replace(/^www\./, '')
  // Strip path, query, hash
  const slashIdx = s.indexOf('/')
  if (slashIdx !== -1) s = s.slice(0, slashIdx)
  const queryIdx = s.indexOf('?')
  if (queryIdx !== -1) s = s.slice(0, queryIdx)
  const hashIdx = s.indexOf('#')
  if (hashIdx !== -1) s = s.slice(0, hashIdx)
  return s || null
}

/**
 * Builds a logo.dev image URL for the given domain.
 *
 * @param {string|null} domain - Bare domain string.
 * @param {string} token - logo.dev public token.
 * @returns {string|null} Full logo URL or `null` if domain is null.
 */
const buildLogoUrl = (domain, token) => {
  if (!domain) return null
  return `https://img.logo.dev/${domain}?token=${token}`
}

// ---------------------------------------------------------------------------
// Row enrichment
// ---------------------------------------------------------------------------

/**
 * Maps a raw sheet row to a `map_startups` DB-ready object.
 * Geocodes the address and derives the region. Never throws.
 *
 * @param {Record<string, string>} rawRow - Parsed CSV row.
 * @param {string} logoToken - logo.dev public token.
 * @returns {Promise<Record<string, unknown>>} DB-ready row object.
 */
const enrichRow = async (rawRow, logoToken) => {
  const address = rawRow['Full Address'] ?? ''
  const { lat, lng } = await geocodeAddress(address)
  const region = deriveRegion(lat, lng)
  const domain = extractDomain(rawRow['Website'])
  const logoUrl = buildLogoUrl(domain, logoToken)

  return {
    name: rawRow['Startup Name'] ?? null,
    address: address || null,
    description: rawRow['Description of startup'] || null,
    website: rawRow['Website'] || null,
    linkedin: rawRow['LinkedIn Link (map it to Links to get the logo)'] || null,
    stage: rawRow['Stage'] || null,
    employee_range: rawRow['# of Employees'] || null,
    sector: rawRow['Section'] || null,
    lat,
    lng,
    region,
    logo_url: logoUrl,
    verified: true,
    is_hiring: false,
  }
}

// ---------------------------------------------------------------------------
// Supabase operations
// ---------------------------------------------------------------------------

/**
 * Deletes all rows from `map_startups` using a sentinel-UUID `.neq` trick
 * so the delete matches every row. Appends a warning on error but does not throw.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<void>}
 */
const truncateTable = async (supabase) => {
  const { error } = await supabase
    .from('map_startups')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) {
    appendWarning(`truncateTable error: ${error.message}`)
  }
}

/**
 * Batch-inserts rows into `map_startups` in chunks.
 * On chunk error, appends a warning and counts those rows as failed.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<Record<string, unknown>>} rows - Enriched rows to insert.
 * @param {number} [batchSize=50] - Rows per insert call.
 * @returns {Promise<{inserted: number, insertFailures: number}>}
 */
const batchInsert = async (supabase, rows, batchSize = 50) => {
  let inserted = 0
  let insertFailures = 0

  for (let start = 0; start < rows.length; start += batchSize) {
    const chunk = rows.slice(start, start + batchSize)
    const { error } = await supabase.from('map_startups').insert(chunk)
    if (error) {
      appendWarning(
        `batchInsert error for rows ${start}–${start + chunk.length - 1}: ${error.message}`,
      )
      insertFailures += chunk.length
    } else {
      inserted += chunk.length
    }
  }

  return { inserted, insertFailures }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = async () => {
  // 1. Load env
  const env = loadEnv()

  // 2. Fetch + parse CSV
  const csvText = await fetchSheetCsv()
  const rows = parseCsv(csvText)
  const total = rows.length

  const logoToken = env['VITE_LOGO_DEV_TOKEN'] ?? ''

  // 3. Enrich rows sequentially (rate-limit: 1 req/sec via 1100ms sleep)
  const enrichedRows = []
  let geocodeFailures = 0

  for (let i = 0; i < rows.length; i++) {
    if (i > 0) await sleep(1100)
    const enriched = await enrichRow(rows[i], logoToken)
    if (enriched.lat == null || enriched.lng == null) geocodeFailures++
    enrichedRows.push(enriched)
  }

  // 4. Instantiate Supabase client (prefer service-role key)
  const key = env['SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_ANON_KEY']
  if (!key) throw new Error('Missing Supabase key in .env.local')
  if (!env['VITE_SUPABASE_URL']) throw new Error('Missing VITE_SUPABASE_URL in .env.local')

  const supabase = createClient(env['VITE_SUPABASE_URL'], key, {
    auth: { persistSession: false },
  })

  // 5. Truncate + batch insert
  await truncateTable(supabase)
  const { inserted, insertFailures } = await batchInsert(supabase, enrichedRows)

  // 6. Summary (single intentional console.log — see JSDoc header)
  console.log(
    `Imported ${inserted}/${total} rows | geocode failures: ${geocodeFailures} | insert failures: ${insertFailures}`,
  )

  if (inserted === 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
