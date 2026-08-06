import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('../../src/modules/dashboard/components/DashboardCharts.jsx', import.meta.url);

test('las gráficas usan colores CSS válidos sin perder sus degradados', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.doesNotMatch(source, /<Bar[^>]+fill="url\(/);
  assert.match(source, /fill="#0799a8" shape={<DashboardIncomeBar \/>}/);
  assert.match(source, /fill="#d48b09" shape={<DashboardExpensesBar \/>}/);
  assert.match(source, /<Rectangle \{\.\.\.props} fill="url\(#dashboardIncome\)" \/>/);
  assert.match(source, /<Rectangle \{\.\.\.props} fill="url\(#dashboardExpenses\)" \/>/);
});

test('los ejes evitan mediciones CSS inválidas en Firefox', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /<XAxis[^>]+interval=\{0}/);
  assert.match(source, /<YAxis[^>]+interval=\{0}/);
});
