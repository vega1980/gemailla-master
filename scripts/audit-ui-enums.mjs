import ts from 'typescript';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mutableCollectionSchemas } from '../src/shared/validation/domainSchemas.js';

// Audit current source, not a second hardcoded copy of the option values.
const definitions = [
  { collection: 'crmClients', field: 'status', file: 'src/features/crm/components/ClientList.jsx', object: 'statusConfig', rule: 'validCrmClient', fixture: { companyId: 'audit', name: 'Cliente', status: 'activo' } },
  { collection: 'crmInteractions', field: 'type', file: 'src/features/crm/components/ClientList.jsx', object: 'interactionTypeLabel', rule: 'validCrmInteraction', fixture: { companyId: 'audit', clientId: 'client', type: 'llamada', date: '2026-11-14', subject: 'Seguimiento' } },
  { collection: 'employees', field: 'employmentType', file: 'src/features/hr/components/EmployeeDirectory.jsx', select: 'form.employmentType', rule: 'validEmployee', fixture: { companyId: 'audit', fullName: 'Empleado', employmentType: 'tiempo_completo', status: 'activo' } },
  { collection: 'payroll', field: 'status', file: 'src/features/hr/components/PayrollManager.jsx', object: 'statusConfig', rule: 'validPayroll', fixture: { companyId: 'audit', employeeId: 'employee', period: '2026-11', period_type: 'mensual', baseSalary: 1000, bonuses: 0, overtime: 0, deductions_imss: 0, deductions_isr: 0, other_deductions: 0, netPay: 1000, status: 'pendiente' } },
  { collection: 'kpis', field: 'frequency', file: 'src/features/operations/components/StrategicKPIs.jsx', select: 'form.frequency', rule: 'validKpi', fixture: { companyId: 'audit', name: 'KPI', target: 10, current: 2, frequency: 'mensual', status: 'en_curso' } },
];
function nodes(root, predicate) {
  const found = [];
  function visit(node) { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }
  visit(root); return found;
}
function one(items, label) {
  if (items.length !== 1) throw new Error(`Expected one ${label}; found ${items.length}. Update the audit extractor, do not assume parity.`);
  return items[0];
}
function same(a, b) { return a.length === b.length && a.every(value => b.includes(value)); }
const rules = await readFile('firestore.rules', 'utf8');
const catalogs = [];
for (const definition of definitions) {
  const { collection, field, file } = definition;
  const text = await readFile(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let options;
  if (definition.object) {
    const declaration = one(nodes(source, node => ts.isVariableDeclaration(node) && node.name.getText(source) === definition.object), definition.object);
    if (!ts.isObjectLiteralExpression(declaration.initializer)) throw new Error('UI option map is no longer a literal');
    options = declaration.initializer.properties.map(property => {
      const name = property.name;
      if (!name || !(ts.isIdentifier(name) || ts.isStringLiteral(name))) throw new Error('Unsupported UI option key');
      return { value: name.text, line: source.getLineAndCharacterOfPosition(name.getStart(source)).line + 1 };
    });
  } else {
    const select = one(nodes(source, node => ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'Select' && node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'value' && attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression?.getText(source) === definition.select)), definition.select);
    const literals = definition.collection === 'kpis'
      ? one(nodes(select, ts.isArrayLiteralExpression), 'frequency array').elements
      : nodes(select, node => ts.isJsxAttribute(node) && node.name.getText(source) === 'value' && node.initializer && ts.isStringLiteral(node.initializer)).map(node => node.initializer);
    options = literals.map(node => {
      if (!ts.isStringLiteral(node)) throw new Error('Unsupported dynamic UI option');
      return { value: node.text, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 };
    });
  }
  if (!options.length || new Set(options.map(option => option.value)).size !== options.length) throw new Error('Missing or duplicate UI options');
  const schema = mutableCollectionSchemas[collection];
  const zodAllowed = schema.shape[field].options;
  if (!Array.isArray(zodAllowed) || !schema.safeParse(definition.fixture).success) throw new Error(`Invalid positive fixture or enum for ${collection}`);
  const body = one([...rules.matchAll(new RegExp(`function\\s+${definition.rule}\\(data\\)\\s*\\{([^}]+)\\}`, 'g'))], definition.rule);
  const ruleArray = one([...body[1].matchAll(new RegExp(`data\\.${field}\\s+in\\s*\\[([^\\]]+)\\]`, 'g'))], `${definition.rule}.${field}`);
  const firestoreAllowed = [...ruleArray[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  if (!firestoreAllowed.length) throw new Error('Could not extract the Firestore enum');
  const zodRuleParity = same(zodAllowed, firestoreAllowed);
  const uiOptions = options.map(option => ({
    ...option,
    zodAccepted: schema.safeParse({ ...definition.fixture, [field]: option.value }).success,
    firestoreEnumAccepted: firestoreAllowed.includes(option.value),
  }));
  const ruleLine = rules.slice(0, body.index).split('\n').length;
  catalogs.push({ collection, field, uiFile: file, rule: definition.rule, ruleLine, zodAllowed, firestoreAllowed, zodRuleParity, positiveFixtureAccepted: true, uiOptions, rejectedUiValues: uiOptions.filter(option => !option.zodAccepted || !option.firestoreEnumAccepted).map(option => option.value), schemaValuesNotOfferedByUi: zodAllowed.filter(value => !options.some(option => option.value === value)) });
}
const report = {
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  scope: 'Five UI catalogs extracted with TypeScript JSX AST; actual Zod safeParse and literal enum clauses of repository Firestore rules. No production database or emulator writes.',
  checkedCatalogs: catalogs.length,
  zodFirestoreParity: catalogs.every(catalog => catalog.zodRuleParity),
  rejectedUiValueCount: catalogs.reduce((sum, catalog) => sum + catalog.rejectedUiValues.length, 0),
  catalogs,
};
const argument = process.argv.find(value => value.startsWith('--output='));
if (argument) await writeFile(argument.slice('--output='.length), JSON.stringify(report, null, 2) + '\n');
console.info(JSON.stringify(report, null, 2));
if (report.rejectedUiValueCount || !report.zodFirestoreParity) process.exitCode = 1;
