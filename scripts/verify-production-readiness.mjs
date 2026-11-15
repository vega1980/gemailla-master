import { spawnSync } from 'node:child_process';

// A local rejection benchmark cannot satisfy the authenticated staging gate.
const target = process.env.LOAD_TARGET_URL && new URL(process.env.LOAD_TARGET_URL);
if (!target || target.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
  throw new Error('Readiness requires an explicit HTTPS staging LOAD_TARGET_URL, not an emulator.');
}
for (const script of ['audit:production', 'test:gemini:live', 'test:load:ai']) {
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit', env: { ...process.env, LOAD_MODE: 'authenticated' } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.info('Configured checks passed. Business validation, IAM, recovery and production approval remain separate requirements.');
