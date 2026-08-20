import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../../.github/workflows/firebase-security-rules.yml', import.meta.url);

test('Firebase rules production deployment requires manual dispatch and production approval', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

  assert.doesNotMatch(workflow, /^\s{2}push:/m);
  assert.match(workflow, /^\s{2}workflow_dispatch:/m);
  assert.match(workflow, /^\s{2}deploy-rules:\n\s{4}if: \$\{\{ github\.event_name == 'workflow_dispatch' \}\}/m);
  assert.match(workflow, /^\s{4}environment: production$/m);
  assert.match(workflow, /^\s{4}needs: validate-rules$/m);
});
