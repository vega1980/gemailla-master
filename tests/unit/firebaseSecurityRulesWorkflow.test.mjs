import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../../.github/workflows/firebase-security-rules.yml', import.meta.url);
const ciWorkflowUrl = new URL('../../.github/workflows/ci.yml', import.meta.url);

test('Firebase rules production deployment requires explicit confirmation and production approval', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

  assert.doesNotMatch(workflow, /^\s{2}push:/m);
  assert.match(workflow, /^\s{2}workflow_dispatch:/m);
  assert.match(workflow, /^\s{6}confirm_production_deploy:$/m);
  assert.match(workflow, /inputs\.confirm_production_deploy == 'DEPLOY_PRODUCTION_RULES'/);
  assert.match(workflow, /^\s{2}deploy-rules:\n\s{4}if: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.confirm_production_deploy == 'DEPLOY_PRODUCTION_RULES' \}\}/m);
  assert.match(workflow, /^\s{4}environment: production$/m);
  assert.match(workflow, /^\s{4}needs: validate-rules$/m);
  assert.match(workflow, /Require production credentials/);
  assert.doesNotMatch(workflow, /Skip deployment \(Firebase secrets not configured\)/);
});

test('CI installs ripgrep and propagates Security Scan execution errors', async () => {
  const workflow = await readFile(ciWorkflowUrl, 'utf8');

  assert.match(workflow, /sudo apt-get install --yes ripgrep/);
  assert.match(workflow, /command -v rg/);
  assert.match(workflow, /rg --version/);
  assert.match(workflow, /if \[ "\$scan_status" -ne 1 \]; then/);
  assert.doesNotMatch(workflow, /rg[^\n]*\|\| true/);
});
