/**
 * Shared helper: LLM client using Google Gemini API.
 * Usage: import { callLLM } from '../_shared/llm.js'
 */

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.0-flash';

/** Map from JSON Schema type strings to Gemini Schema type strings. */
const TYPE_MAP = {
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
  array: 'ARRAY',
  object: 'OBJECT',
};

/**
 * Convert a JSON Schema object into Google Gemini's responseSchema format.
 * Handles type arrays like `['string', 'null']` → `{ type: 'STRING', nullable: true }`.
 *
 * @param {object} schema - JSON Schema object.
 * @returns {object} Gemini-compatible schema.
 */
function toGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const out = { ...schema };

  if (Array.isArray(out.type)) {
    const nonNull = out.type.filter((t) => t !== 'null');
    const base = (nonNull[0] ?? 'string').toLowerCase();
    out.type = TYPE_MAP[base] ?? base.toUpperCase();
    out.nullable = true;
  } else if (typeof out.type === 'string') {
    out.type = TYPE_MAP[out.type.toLowerCase()] ?? out.type.toUpperCase();
  }

  if (out.properties && typeof out.properties === 'object') {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, toGeminiSchema(v)])
    );
  }

  // Remove JSON-Schema-specific fields Gemini doesn't support
  delete out.required;
  delete out.additionalProperties;

  return out;
}

/**
 * Call Google Gemini to generate content or structured JSON output.
 *
 * @param {{ model?: string, systemPrompt: string, userPrompt: string, schema?: object }} options
 *   - model: Gemini model ID (defaults to 'gemini-2.0-flash')
 *   - systemPrompt: system instruction content
 *   - userPrompt: user turn content
 *   - schema: optional JSON Schema object; when provided forces JSON output matching the schema
 * @returns {Promise<string|object>} Text string when no schema provided,
 *   or parsed JSON object when schema is provided
 * @throws {Error} if GOOGLE_AI_API_KEY is not set
 * @throws {Error} if the HTTP call returns a non-2xx response
 */
export async function callLLM({ model, systemPrompt, userPrompt, schema }) {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set');

  const resolvedModel = model ?? DEFAULT_MODEL;
  const url = `${GEMINI_BASE_URL}/${resolvedModel}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  };

  if (schema) {
    body.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(schema),
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`LLM call failed: ${response.status} ${errBody}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (schema) {
    try {
      return JSON.parse(text);
    } catch (_) {
      throw new Error(`LLM returned invalid JSON: ${text}`);
    }
  }

  return text;
}
