#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve('.');
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const ALLOWED_FIREBASE_IMPORT_FILES = new Set([
  'src/firebase.js',
  'src/api/firebaseClient.js',
]);
const PUBLIC_VITE_ALLOWLIST = new Set([
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_APP_VERSION',
  'VITE_BUILD_ID',
  'VITE_GIT_SHA',
  'VITE_DEPLOY_ENV',
]);
const SENSITIVE_VITE_PATTERN = /VITE_[A-Z0-9_]*(SECRET|PRIVATE|TOKEN|PASSWORD|PASS|OPENAI|STRIPE_SECRET|SERVICE_ACCOUNT|CLIENT_SECRET|WEBHOOK_SECRET|ADMIN|CREDENTIAL)[A-Z0-9_]*/g;

const LEGACY_DUPLICATE_FILES = new Map([
  ['src/App.jsx', 'El bootstrap debe importar src/app/App.jsx directamente; no mantener un segundo App raíz.'],
  ['src/pages/Dashboard.backup.jsx', 'No conservar snapshots legacy de Dashboard dentro de src/pages. Usa control de versiones.'],
  ['src/pages/Dashboard.original.jsx', 'No conservar snapshots legacy de Dashboard dentro de src/pages. Usa control de versiones.'],
]);
const LEGACY_PAGE_COPY_PATTERN = /(?:^|\/)[A-Z][^/]*\.(?:backup|original|old|legacy)\.[jt]sx?$/i;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'coverage', '.firebase'].includes(entry)) continue;
    const abs = join(dir, entry);
    const stats = statSync(abs);
    if (stats.isDirectory()) walk(abs, files);
    else files.push(abs);
  }
  return files;
}

function extname(file) {
  const match = file.match(/\.[^.]+$/);
  return match ? match[0] : '';
}

function toRepoPath(abs) {
  return relative(ROOT, abs).split(sep).join('/');
}

function normalizeRepoPath(path) {
  return path.split(sep).join('/');
}

function resolveImportPath(importPath, importerRepoPath) {
  if (importPath.startsWith('@/')) return importPath.replace('@/', 'src/');
  if (importPath.startsWith('@modules/')) return importPath.replace('@modules/', 'src/modules/');
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return normalizeRepoPath(relative(ROOT, resolve(ROOT, dirname(importerRepoPath), importPath)));
  }
  return importPath;
}

function stripSourceExtension(repoPath) {
  return repoPath.replace(/\.(?:js|jsx|ts|tsx)$/, '');
}

function collectImportSpecifiers(source) {
  const importPattern = /(?:import|export)\s+(?:[^'";]+\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  return [...source.matchAll(importPattern)].map((match) => match[1] || match[2]);
}

function collectSourceFiles(base = 'src') {
  const absBase = resolve(ROOT, base);
  if (!existsSync(absBase)) return [];
  return walk(absBase).filter((file) => SOURCE_EXTENSIONS.has(extname(file)));
}

function addIssue(issues, check, file, message) {
  issues.push({ check, file, message });
}


function validateLegacyDuplicateArchitecture(issues) {
  for (const [file, message] of LEGACY_DUPLICATE_FILES) {
    if (existsSync(resolve(ROOT, file))) addIssue(issues, 'legacy-duplicates', file, message);
  }

  for (const abs of collectSourceFiles('src/pages')) {
    const repoPath = toRepoPath(abs);
    if (LEGACY_PAGE_COPY_PATTERN.test(repoPath)) {
      addIssue(issues, 'legacy-duplicates', repoPath, 'Archivo de página con sufijo legacy/backup/original detectado. Mantén una sola implementación activa por página.');
    }
  }
}

function validateRouteEntrypoints(issues) {
  const routesPath = 'src/app/routes.jsx';
  const absRoutesPath = resolve(ROOT, routesPath);
  if (!existsSync(absRoutesPath)) return;

  const source = readFileSync(absRoutesPath, 'utf8');
  const modulePageEntrypointPattern = /^src\/modules\/[^/]+\/pages\/[^/]+Page$/;

  for (const importPath of collectImportSpecifiers(source)) {
    const resolvedImportPath = stripSourceExtension(resolveImportPath(importPath, routesPath));
    const isPageEntrypointCandidate = resolvedImportPath.startsWith('src/pages/')
      || resolvedImportPath.includes('/pages/')
      || /Page$/.test(resolvedImportPath);
    if (!isPageEntrypointCandidate) continue;

    if (resolvedImportPath.startsWith('src/pages/')) {
      addIssue(
        issues,
        'route-entrypoints',
        routesPath,
        'Las rutas de aplicación no deben importar directamente desde src/pages. Publica cada pantalla desde src/modules/<bounded-context>/pages para mantener una única frontera modular.',
      );
      continue;
    }

    if (!modulePageEntrypointPattern.test(resolvedImportPath)) {
      addIssue(
        issues,
        'route-entrypoints',
        routesPath,
        `Ruta con import fuera de src/modules/<dominio>/pages: ${importPath}.`,
      );
    }
  }
}

function validateModulePageBoundaries(issues) {
  const moduleFiles = collectSourceFiles('src/modules');
  const legacyPageWrapperPattern = /^\s*export\s+\{\s*default\s*\}\s+from\s+['"]([^'"]+)['"];\s*$/;

  for (const abs of moduleFiles) {
    const repoPath = toRepoPath(abs);
    const source = readFileSync(abs, 'utf8');
    const importSpecifiers = collectImportSpecifiers(source);
    const importsFromSrcPages = importSpecifiers.some((importPath) => resolveImportPath(importPath, repoPath).startsWith('src/pages/'));

    if (importsFromSrcPages) {
      addIssue(
        issues,
        'module-page-boundaries',
        repoPath,
        'Los módulos no deben importar ni exportar desde src/pages. Mueve la implementación real al módulo correspondiente.',
      );
    }

    const wrapperMatch = source.match(legacyPageWrapperPattern);
    if (wrapperMatch && resolveImportPath(wrapperMatch[1], repoPath).startsWith('src/pages/')) {
      addIssue(
        issues,
        'legacy-page-wrappers',
        repoPath,
        'Wrapper de una sola línea hacia una página legacy detectado. No ocultes src/pages detrás de facades: migra la implementación real.',
      );
    }
  }
}

function validateUnusedModuleNameIndexes(issues) {
  const modulesRoot = resolve(ROOT, 'src/modules');
  if (!existsSync(modulesRoot)) return;

  const sourceFiles = collectSourceFiles('src');
  for (const entry of readdirSync(modulesRoot)) {
    const indexPath = join(modulesRoot, entry, 'index.js');
    if (!existsSync(indexPath)) continue;

    const repoPath = toRepoPath(indexPath);
    const source = readFileSync(indexPath, 'utf8').trim();
    if (!/^export\s+const\s+moduleName\s*=\s*['"][^'"]+['"];?$/.test(source)) continue;

    const importPattern = new RegExp(`['"](?:@modules/${entry}|@/modules/${entry})(?:/index)?['"]`);
    const hasConsumer = sourceFiles.some((file) => {
      if (file === indexPath) return false;
      return importPattern.test(readFileSync(file, 'utf8'));
    });

    if (!hasConsumer) {
      addIssue(
        issues,
        'unused-module-index',
        repoPath,
        'index.js solo exporta moduleName y no tiene consumidores. Elimínalo o añade una API pública real consumida.',
      );
    }
  }
}

function validateFirebaseImports(issues) {
  const importPattern = /(?:import|export)\s+(?:[^'";]+\s+from\s+)?['"]((?:@\/firebase|firebase)(?:\/[^'"]*)?)['"]|import\(['"]((?:@\/firebase|firebase)(?:\/[^'"]*)?)['"]\)/g;
  for (const abs of collectSourceFiles('src')) {
    const repoPath = toRepoPath(abs);
    if (repoPath.startsWith('src/infrastructure/')) continue;
    if (repoPath.startsWith('src/e2e/')) continue;
    if (ALLOWED_FIREBASE_IMPORT_FILES.has(repoPath)) continue;
    const source = readFileSync(abs, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      addIssue(issues, 'firebase-imports', repoPath, `Import directo/alternativo de Firebase no permitido fuera de src/infrastructure: ${match[1] || match[2]}. Usa el facade de infraestructura/API.`);
    }
  }
}

function validateFeatureCompanyGuards(issues) {
  const featureFiles = collectSourceFiles('src/features').filter((file) => /Flow\.[jt]sx?$/.test(file));
  const mutatingFlowPattern = /\b(firebase\.(?:entities|agents|functions|integrations)|invokeLLM|uploadDocumentFlow|analyzeDocumentFlow)\b/;
  const companyScopedPattern = /\bcompany(?:\?\.)?\.id\b|\bcompanyId\b/;
  const guardPattern = /if\s*\(\s*!\s*(?:company\?\.id|company\.id|companyId|safeCompanyId)\s*\)|throw new Error\([^)]*empresa activa|companyId\s*=\s*(?:typeof\s+)?[^;\n]+\?[^;\n]+:\s*['"]{2}/i;

  for (const abs of featureFiles) {
    const repoPath = toRepoPath(abs);
    const source = readFileSync(abs, 'utf8');
    if (!mutatingFlowPattern.test(source) || !companyScopedPattern.test(source)) continue;
    if (!guardPattern.test(source)) {
      addIssue(issues, 'feature-company-guards', repoPath, 'Flujo con operaciones company-scoped sin validación explícita de company.id/companyId antes de ejecutar efectos externos.');
    }
  }
}

function validateSensitiveViteVariables(issues) {
  const scanFiles = [
    ...collectSourceFiles('src'),
    ...collectSourceFiles('functions'),
  ].filter((file) => existsSync(file));
  if (existsSync(resolve(ROOT, 'dist'))) {
    scanFiles.push(...walk(resolve(ROOT, 'dist')).filter((file) => /\.(js|css|html|map)$/.test(file)));
  }
  for (const abs of scanFiles) {
    const repoPath = toRepoPath(abs);
    const source = readFileSync(abs, 'utf8');
    const matches = new Set(source.match(SENSITIVE_VITE_PATTERN) || []);
    for (const name of matches) {
      if (!PUBLIC_VITE_ALLOWLIST.has(name)) {
        addIssue(issues, 'sensitive-vite', repoPath, `Variable sensible expuesta con prefijo VITE_: ${name}. Los secretos deben vivir en backend/Functions sin prefijo VITE_.`);
      }
    }
  }
}

function normalizeIndexes(json) {
  const normalized = {
    indexes: [...(json.indexes || [])].map((index) => ({
      collectionGroup: index.collectionGroup,
      queryScope: index.queryScope || 'COLLECTION',
      fields: [...(index.fields || [])].map((field) => ({
        fieldPath: field.fieldPath,
        order: field.order,
        arrayConfig: field.arrayConfig,
      })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    fieldOverrides: [...(json.fieldOverrides || [])].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
  return JSON.stringify(normalized, null, 2);
}

function validateFirestoreIndexes(issues, options) {
  const firebaseConfigPath = resolve(ROOT, 'firebase.json');
  const indexesPath = resolve(ROOT, 'firestore.indexes.json');
  if (!existsSync(firebaseConfigPath)) addIssue(issues, 'firestore-indexes', 'firebase.json', 'No existe firebase.json.');
  if (!existsSync(indexesPath)) addIssue(issues, 'firestore-indexes', 'firestore.indexes.json', 'No existe firestore.indexes.json.');
  if (!existsSync(firebaseConfigPath) || !existsSync(indexesPath)) return;

  const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, 'utf8'));
  if (firebaseConfig.firestore?.indexes !== 'firestore.indexes.json') {
    addIssue(issues, 'firestore-indexes', 'firebase.json', 'firebase.json no apunta a firestore.indexes.json en firestore.indexes.');
  }
  JSON.parse(readFileSync(indexesPath, 'utf8'));

  if (options.project) {
    try {
      const remote = execFileSync('npx', ['firebase', 'firestore:indexes', '--project', options.project, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (normalizeIndexes(JSON.parse(remote)) !== normalizeIndexes(JSON.parse(readFileSync(indexesPath, 'utf8')))) {
        addIssue(issues, 'firestore-indexes', 'firestore.indexes.json', `Los índices locales no coinciden con el proyecto Firebase ${options.project}.`);
      }
    } catch (error) {
      addIssue(issues, 'firestore-indexes', 'firestore.indexes.json', `No se pudo consultar Firebase CLI para el proyecto ${options.project}: ${error.message}`);
    }
  }
}

function parseArgs(argv) {
  const options = { project: process.env.FIREBASE_PROJECT_ID || '' };
  for (const arg of argv) {
    if (arg.startsWith('--project=')) options.project = arg.slice('--project='.length);
    if (arg === '--local-only') options.project = '';
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const issues = [];
  validateLegacyDuplicateArchitecture(issues);
  validateRouteEntrypoints(issues);
  validateModulePageBoundaries(issues);
  validateUnusedModuleNameIndexes(issues);
  validateFirebaseImports(issues);
  validateFeatureCompanyGuards(issues);
  validateSensitiveViteVariables(issues);
  validateFirestoreIndexes(issues, options);

  if (issues.length > 0) {
    console.error('❌ Validación de arquitectura fallida:');
    for (const issue of issues) console.error(`  - [${issue.check}] ${issue.file}: ${issue.message}`);
    process.exit(1);
  }

  const remoteText = options.project ? ` e índices remotos del proyecto ${options.project}` : ' (índices remotos omitidos; usa --project=<id> en CI con credenciales)';
  console.log(`✅ Arquitectura validada: duplicados legacy, imports Firebase, guards company.id, VITE sensibles e índices Firestore${remoteText}.`);
}

main();
