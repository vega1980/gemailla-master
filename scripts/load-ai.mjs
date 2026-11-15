import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';

// Closed-loop, bounded load. No retries: rate limits/errors count as failures.
const mode = process.env.LOAD_MODE || 'authenticated';
const target = new URL(process.env.LOAD_TARGET_URL || 'http://127.0.0.1:5000/api/ai');
const local = ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname);
if (!['authenticated', 'rejection'].includes(mode)) throw new Error('LOAD_MODE must be authenticated or rejection');
if (target.username || target.password || target.search || target.hash || !['http:', 'https:'].includes(target.protocol)) throw new Error('Use a clean HTTP(S) API URL without credentials/query/hash');
if (mode === 'rejection' && !local) throw new Error('Rejection-only load is restricted to local emulators');
if (!local && target.protocol !== 'https:') throw new Error('Remote load requires HTTPS');
const token = process.env.LOAD_AUTH_TOKEN;
const companyId = process.env.LOAD_COMPANY_ID;
if (mode === 'authenticated' && (!token || !companyId)) throw new Error('Authenticated load requires LOAD_AUTH_TOKEN and LOAD_COMPANY_ID from a staging test company');
function integer(name, fallback, max) {
  const n = Number(process.env[name] || fallback);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`${name} must be an integer in [1, ${max}]`);
  return n;
}
const concurrency = integer('LOAD_CONCURRENCY', 4, 10);
const requests = integer('LOAD_REQUESTS', 20, 200);
const timeoutMs = integer('LOAD_TIMEOUT_MS', 10000, 90000);
const maxP95Ms = integer('LOAD_MAX_P95_MS', 60000, 90000);
const results = [];
let next = 0;
const started = performance.now();
async function worker() {
  while (next < requests) {
    const index = next++;
    const start = performance.now();
    let status = 0, ok = false;
    try {
      const response = await fetch(target, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'Content-Type': 'application/json', Origin: target.origin,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(process.env.LOAD_APP_CHECK_TOKEN ? { 'X-Firebase-AppCheck': process.env.LOAD_APP_CHECK_TOKEN } : {}),
        },
        body: JSON.stringify({ prompt: 'Responde brevemente: verificación operativa.', ...(companyId ? { companyId } : {}) }),
      });
      status = response.status;
      const body = await response.json();
      ok = mode === 'rejection'
        ? status === 401 && Boolean(body.correlationId)
        : status === 200 && body.status === 'completed' && body.provider === 'vertex-gemini' && body.companyId === companyId && Boolean(body.response);
    } catch { /* Do not print tokens, document content or provider errors. */ }
    results.push({ index, status, ok, durationMs: performance.now() - start });
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, worker));
const durationSeconds = (performance.now() - started) / 1000;
const sorted = results.map(r => r.durationMs).sort((a, b) => a - b);
const percentile = p => sorted[Math.ceil(p * sorted.length) - 1];
const failed = results.filter(r => !r.ok).length;
const passed = results.length === requests && failed === 0 && percentile(0.95) <= maxP95Ms;
const report = {
  scenario: mode, scope: local ? 'local-emulators' : 'configured-remote-api',
  requests: results.length, concurrency, failed, passed, durationSeconds,
  requestsPerSecond: results.length / durationSeconds,
  p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: sorted.at(-1),
  thresholds: { maxFailed: 0, maxP95Ms },
  statuses: results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {}),
  productionApproval: false,
};
console.info(JSON.stringify(report, null, 2));
if (process.env.LOAD_REPORT_PATH) await writeFile(process.env.LOAD_REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
if (!passed) process.exitCode = 1;
