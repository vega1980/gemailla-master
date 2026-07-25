#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const SECRET_PATTERNS = [
  {
    name: 'Clave de proveedor LLM con formato OpenAI',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    name: 'Asignación literal de clave OpenAI',
    pattern: /\b(?:api[_-]?key|openai[_-]?api[_-]?key|OPENAI_API_KEY|GOOGLE_API_KEY|GEMINI_API_KEY)\b\s*(?:<-|=|:|=>)\s*['"]sk-(?:proj-)?[A-Za-z0-9_-]{16,}['"]/gi,
  },
  {
    name: 'Clave Google API con formato AIza',
    pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  },
  {
    name: 'Asignación literal de clave Google API',
    pattern: /\b(?:google[_-]?api[_-]?key|gemini[_-]?api[_-]?key|GOOGLE_API_KEY|GEMINI_API_KEY)\b\s*(?:<-|=|:|=>)\s*['"]AIza[0-9A-Za-z_-]{20,}['"]/gi,
  },
];

const ALLOWED_BINARY_EXTENSIONS = new Set([
  '.avif', '.gif', '.ico', '.jpg', '.jpeg', '.pdf', '.png', '.webp', '.woff', '.woff2', '.zip',
]);

function getTrackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function hasBinaryExtension(filePath) {
  const lower = filePath.toLowerCase();
  return [...ALLOWED_BINARY_EXTENSIONS].some((extension) => lower.endsWith(extension));
}

function scanFile(filePath) {
  if (hasBinaryExtension(filePath)) return [];
  const content = readFileSync(filePath, 'utf8');
  return scanContent({ filePath, content });
}

function scanContent({ filePath, content }) {
  const findings = [];
  const lineStarts = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\n') lineStarts.push(index + 1);
  }

  for (const { name, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const line = lineStarts.findLastIndex((start) => start <= match.index) + 1;
      findings.push({ filePath, line, name });
    }
  }
  return findings;
}

function main() {
  const findings = getTrackedFiles().flatMap(scanFile);

  if (findings.length > 0) {
    console.error('❌ Posibles claves hardcodeadas detectadas. Usa variables de entorno o un gestor de secretos.');
    for (const finding of findings) {
      console.error(`  - ${finding.filePath}:${finding.line} (${finding.name})`);
    }
    process.exit(1);
  }

  console.log('✅ No se detectaron claves hardcodeadas en archivos versionados.');
}

const isMainModule = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMainModule) {
  main();
}

export {
  SECRET_PATTERNS,
  getTrackedFiles,
  hasBinaryExtension,
  scanContent,
  scanFile,
};
