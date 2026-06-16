import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const allowedPlaceholderFiles = new Set([
  '.firebaserc.example',
  'public/app-config.example.js',
]);

const trackedFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((file) => !allowedPlaceholderFiles.has(file))
  .filter((file) => !file.startsWith('node_modules/'))
  .filter((file) => file !== 'package-lock.json');

const forbiddenPatterns = [
  { name: 'Firebase Web API key', pattern: /AIza[0-9A-Za-z_-]{20,}/ },
  { name: 'Known production Firebase project id', pattern: new RegExp(['gemailla', 'enterprise'].join('-'), 'i') },
  { name: 'Concrete Firebase auth domain', pattern: /(?<!TU_PROJECT_ID)(?<!your-firebase-project-id)\b[a-z0-9-]+\.firebaseapp\.com\b/i },
  { name: 'Concrete Firebase storage bucket', pattern: /(?<!TU_PROJECT_ID)(?<!your-firebase-project-id)\b[a-z0-9-]+\.(?:appspot|firebasestorage)\.com\b/i },
];

const findings = [];

for (const file of trackedFiles) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const { name, pattern } of forbiddenPatterns) {
      if (pattern.test(line)) {
        findings.push(`${file}:${index + 1}: ${name}`);
      }
    }
  });
}

if (findings.length > 0) {
  console.error('Potential committed Firebase configuration exposure detected:');
  for (const finding of findings) console.error(`- ${finding}`);
  console.error('Move real Firebase config to untracked public/app-config.js, environment variables, or CI/CD secrets.');
  process.exit(1);
}

console.log('No committed real Firebase project identifiers or web API keys detected.');
