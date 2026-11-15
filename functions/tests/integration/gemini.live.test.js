const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { callGeminiVertexAdapter } = require('../../handlers/geminiVertexAdapter');

test('live Vertex Gemini returns validated JSON and real usage metadata', { timeout: 100000 }, async () => {
  const project = process.env.VERTEX_GEMINI_PROJECT;
  const location = process.env.VERTEX_GEMINI_LOCATION;
  const model = process.env.VERTEX_GEMINI_MODEL;
  assert.ok(project && location && model, 'Configure VERTEX_GEMINI_PROJECT, VERTEX_GEMINI_LOCATION and VERTEX_GEMINI_MODEL; this live check must not skip or use mocks.');
  assert.ok(!project.startsWith('demo-'), 'A demo project cannot verify live Vertex.');
  const result = await callGeminiVertexAdapter({
    prompt: 'Responde únicamente con el objeto JSON {"status":"ok"}. No añadas texto.',
    correlationId: `live-${randomUUID()}`,
    model,
    responseJsonSchema: { type: 'object', properties: { status: { type: 'string', enum: ['ok'] } }, required: ['status'], additionalProperties: false },
    providerConfiguration: { project, location, timeoutMs: 45000 },
  });
  assert.deepEqual(JSON.parse(result.outputText), { status: 'ok' });
  assert.equal(result.provider, 'vertex-gemini');
  assert.equal(result.usageAvailable, true);
  assert.ok(result.usage.total_tokens > 0, 'Real token usage must be reported.');
  console.info(JSON.stringify({ check: 'gemini-live', model: result.model, latencyMs: result.latencyMs, usage: result.usage }));
});
