import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const budgetPath = path.join(repoRoot, 'performance-budgets.json');
const budgetScriptPath = path.join(repoRoot, 'scripts/check-bundle-budgets.js');

function readBudgets() {
  return JSON.parse(readFileSync(budgetPath, 'utf8'));
}

describe('bundle budget configuration', () => {
  it('uses modular route entries without legacy src/pages modules', () => {
    const budgets = readBudgets();
    const configuredModules = Object.values(budgets.routes).map((route) => route.module);

    assert.equal(configuredModules.some((modulePath) => modulePath.startsWith('src/pages/')), false);
    assert.equal(budgets.routes['/dashboard'].module, 'src/modules/dashboard/pages/DashboardPage.jsx');
    assert.equal(budgets.routes['/finance'].module, 'src/modules/finance/pages/FinancialHubPage.jsx');
  });

  it('keeps the current numeric bundle limits unchanged', () => {
    const budgets = readBudgets();

    assert.equal(budgets.sharedVendorMaxKb, 650);
    assert.equal(budgets.routes['/dashboard'].routeMaxKb, 95);
    assert.equal(budgets.routes['/documents'].routeMaxKb, 120);
    assert.equal(budgets.routes['/finance'].routeMaxKb, 180);
    assert.equal(budgets.routes['/ai'].routeMaxKb, 140);
  });

  it('does not keep legacy alias compatibility in the budget checker', () => {
    const budgetScript = readFileSync(budgetScriptPath, 'utf8');

    assert.equal(budgetScript.includes(['module', 'Aliases'].join('')), false);
  });

  it('fails when a configured budget module is missing from the manifest', () => {
    const tmpRoot = mkdtempSync(path.join(tmpdir(), 'bundle-budget-missing-manifest-'));
    mkdirSync(path.join(tmpRoot, 'dist/.vite'), { recursive: true });
    mkdirSync(path.join(tmpRoot, 'dist/assets'), { recursive: true });
    cpSync(budgetPath, path.join(tmpRoot, 'performance-budgets.json'));
    writeFileSync(path.join(tmpRoot, 'dist/.vite/manifest.json'), JSON.stringify({}, null, 2));

    const result = spawnSync(process.execPath, [budgetScriptPath], {
      cwd: tmpRoot,
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no se encontró src\/modules\/dashboard\/pages\/DashboardPage\.jsx en manifest/);
  });
});
