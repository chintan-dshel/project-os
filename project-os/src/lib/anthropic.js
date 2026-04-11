/**
 * lib/anthropic.js
 *
 * Thin wrapper around the Anthropic /v1/messages endpoint.
 * All agents call callClaude() — they never fetch() directly.
 *
 * Handles:
 *  - Auth header injection (API key from env, never in agent code)
 *  - Consistent error surfacing with HTTP status preserved
 *  - JSON extraction from responses that mix prose + a JSON block
 *  - Token counting passthrough for conversation history storage
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL             = 'claude-sonnet-4-20250514';
const MAX_TOKENS        = 4096;

/**
 * Call the Anthropic API.
 *
 * @param {object} opts
 * @param {string}   opts.system    - System prompt text
 * @param {Array}    opts.messages  - [{role, content}] conversation history
 * @param {number}  [opts.max_tokens]
 * @returns {Promise<{ text: string, inputTokens: number, outputTokens: number }>}
 */
export async function callClaude({ system, messages, max_tokens = MAX_TOKENS }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in environment');

  const body = {
    model: MODEL,
    max_tokens,
    system,
    messages,
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const err = new Error(`Anthropic API error ${response.status}: ${errorBody}`);
    err.status = response.status === 429 ? 429 : 502;
    throw err;
  }

  const data = await response.json();

  // Extract text blocks (API may return multiple content blocks)
  const text = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return {
    text,
    inputTokens:  data.usage?.input_tokens  ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
  };
}

/**
 * Extract the first valid JSON object from a response string.
 *
 * The Intake Agent is instructed to emit a single JSON block.
 * In practice Claude sometimes wraps it in prose or ```json fences.
 * This function handles all common formats robustly.
 *
 * Returns the parsed object, or null if no valid JSON found.
 */
export function extractJSON(text) {
  if (!text) return null;

  // 1. Try a ```json ... ``` fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (_) { /* fall through */ }
  }

  // 2. Try the first { ... } balanced block in the string
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape)          { escape = false; continue; }
    if (ch === '\\')     { escape = true;  continue; }
    if (ch === '"')      { inString = !inString; continue; }
    if (inString)        continue;
    if (ch === '{')      depth++;
    else if (ch === '}') { depth--; if (depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)); } catch (_) { return null; }
    }}
  }

  return null;
}
