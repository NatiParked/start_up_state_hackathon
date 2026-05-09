/**
 * Shared helper: LLM client for OpenCode Zen (Anthropic-compatible) endpoint.
 * Usage: import { callLLM } from '../_shared/llm.js'
 */

/**
 * Call Claude via the OpenCode Zen Anthropic-compatible endpoint.
 *
 * @param {{ model?: string, systemPrompt: string, userPrompt: string, schema?: object }} options
 *   - model: Anthropic model ID (defaults to 'claude-haiku-4-5')
 *   - systemPrompt: system turn content
 *   - userPrompt: user turn content
 *   - schema: optional JSON Schema object; when provided, forces structured output via tool-use
 * @returns {Promise<string|object>} Concatenated text string when no schema provided,
 *   or the tool-use `input` object when schema is provided
 * @throws {Error} if OPENCODE_ZEN_API_KEY or OPENCODE_ZEN_BASE_URL are not set
 * @throws {Error} if the HTTP call returns a non-2xx response
 */
export async function callLLM({ model, systemPrompt, userPrompt, schema }) {
  const apiKey = Deno.env.get('OPENCODE_ZEN_API_KEY');
  if (!apiKey) throw new Error('OPENCODE_ZEN_API_KEY not set');

  const baseUrl = Deno.env.get('OPENCODE_ZEN_BASE_URL');
  if (!baseUrl) throw new Error('OPENCODE_ZEN_BASE_URL not set');

  const resolvedModel = model ?? 'claude-haiku-4-5';

  const body = {
    model: resolvedModel,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };

  if (schema) {
    body.tools = [{ name: 'respond', input_schema: schema }];
    body.tool_choice = { type: 'tool', name: 'respond' };
  }

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`LLM call failed: ${response.status} ${errBody}`);
  }

  const data = await response.json();

  if (schema) {
    return data.content.find((b) => b.type === 'tool_use').input;
  }

  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
