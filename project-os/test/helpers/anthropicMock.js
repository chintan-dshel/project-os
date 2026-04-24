// Mock globalThis.fetch for Anthropic API calls.
// Lets callClaude() run fully — including writeTrace and insertAgentTrace — so
// DB trace assertions in integration and API tests work without extra seams.

export function mockAnthropicSuccess(text = 'Test response.', usage = { input_tokens: 10, output_tokens: 5 }) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok:   true,
    json: async () => ({
      content: [{ type: 'text', text }],
      usage,
    }),
  });
}

export function mockAnthropicError(status = 500, body = 'Internal Server Error') {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok:     false,
    status,
    text:   async () => body,
  });
}

export function mockAnthropicNetworkFailure() {
  return vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));
}
