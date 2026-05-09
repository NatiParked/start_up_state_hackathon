/**
 * Claude gap-fill prompt assets for the onboard-company pipeline.
 *
 * These exports allow both the main enrichment pipeline and any future
 * direct-LLM extraction path to reuse the same system prompt, user-prompt
 * builder, and output JSON Schema.
 */

/**
 * System prompt instructing Claude to extract only missing company fields
 * from website HTML without inventing data.
 *
 * @type {string}
 */
export const SYSTEM_PROMPT =
  'You are a startup data enrichment assistant. ' +
  'Your task is to extract company information from the provided website HTML. ' +
  'Only extract fields that are explicitly missing (null) in the partial record — ' +
  'do NOT overwrite fields that already have values. ' +
  'Return a single JSON object whose keys match the requested schema. ' +
  'Use null for any field you cannot determine with confidence from the HTML. ' +
  'NEVER invent or guess data that is not clearly present in the HTML. ' +
  'For the "sector" field, you MUST use one of these exact values: ' +
  'fintech, healthtech, edtech, cleantech, enterprise-software, consumer, ' +
  'ecommerce, logistics, biotech, ai-ml, cybersecurity, other. ' +
  'For the "stage" field, you MUST use one of these exact values: ' +
  'idea, pre-seed, seed, series-a, series-b, growth, public, other. ' +
  'Return only valid JSON — no markdown fences, no explanation text.';

/**
 * Build the user-turn prompt for a Claude gap-fill call.
 *
 * The prompt includes:
 *  (a) The partial record JSON-stringified so Claude knows what is already known.
 *  (b) A list of which top-level keys are still null or missing.
 *  (c) The raw homepage HTML, truncated to 8000 characters with a `[truncated]`
 *      suffix appended when the original is longer.
 *
 * @param {string} html - Raw homepage HTML of the company website.
 * @param {object} partialRecord - Partially enriched company record; keys with
 *   null/undefined values indicate fields that need to be filled by Claude.
 * @returns {string} Formatted user prompt string ready to send to Claude.
 */
export function buildUserPrompt(html, partialRecord) {
  const missingKeys = Object.entries(partialRecord)
    .filter(([, v]) => v === null || v === undefined)
    .map(([k]) => k);

  const truncatedHtml =
    typeof html === 'string' && html.length > 8000
      ? html.slice(0, 8000) + '[truncated]'
      : (html ?? '');

  return (
    'Partial record (already known data):\n' +
    JSON.stringify(partialRecord, null, 2) +
    '\n\n' +
    'Fields still missing (null) that you must fill:\n' +
    (missingKeys.length > 0 ? missingKeys.join(', ') : '(none — all fields present)') +
    '\n\n' +
    'Homepage HTML:\n' +
    truncatedHtml
  );
}

/**
 * JSON Schema describing the expected shape of Claude's gap-fill response.
 *
 * All properties are nullable. `founded_year` is an integer; all others are strings.
 *
 * @type {object}
 */
export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: ['string', 'null'],
      description: 'The official company name.',
    },
    description: {
      type: ['string', 'null'],
      description: 'A concise 1–3 sentence description of what the company does.',
    },
    sector: {
      type: ['string', 'null'],
      description:
        'Industry sector. One of: fintech, healthtech, edtech, cleantech, ' +
        'enterprise-software, consumer, ecommerce, logistics, biotech, ai-ml, cybersecurity, other.',
    },
    stage: {
      type: ['string', 'null'],
      description:
        'Company funding/growth stage. One of: idea, pre-seed, seed, series-a, ' +
        'series-b, growth, public, other.',
    },
    founded_year: {
      type: ['integer', 'null'],
      description: 'Year the company was founded (4-digit integer), or null if unknown.',
    },
    address: {
      type: ['string', 'null'],
      description:
        'Physical address of the company headquarters, ' +
        'e.g. "123 Main St, Salt Lake City, UT 84101".',
    },
  },
  required: [],
  additionalProperties: false,
};
