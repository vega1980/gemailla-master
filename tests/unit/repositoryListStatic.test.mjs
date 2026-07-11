import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { describe, it } from 'node:test';

const REPOSITORY_IMPLEMENTATION = 'src/infrastructure/firebase/repositories/createRepository.js';
const SOURCE_FILES = globSync('src/**/*.{js,jsx,mjs,ts,tsx}', {
  exclude: [REPOSITORY_IMPLEMENTATION],
});

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split('\n').length;
}

function formatLocation(file, source, index) {
  return `${relative(process.cwd(), file).split(sep).join('/')}:${lineNumberForIndex(source, index)}`;
}

function findNullishConstants(source) {
  const names = new Set();
  const nullishDeclarationPattern = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:undefined|null)\b/g;

  for (const match of source.matchAll(nullishDeclarationPattern)) {
    names.add(match[1]);
  }

  return names;
}

describe('static guard for bounded repository reads', () => {
  it('does not call repository.list() without filters in application code', () => {
    const violations = [];

    for (const file of SOURCE_FILES) {
      const source = readFileSync(file, 'utf8');
      const nullishConstants = findNullishConstants(source);
      const unboundedListCallPattern = /\.list\s*\(\s*(?:\)|undefined\b|null\b|\/\*[^]*?\*\/\s*\)|\/\/[^\n]*(?:\n\s*)?\)|\{\s*\})/g;

      for (const match of source.matchAll(unboundedListCallPattern)) {
        violations.push(formatLocation(file, source, match.index));
      }

      for (const name of nullishConstants) {
        const nullishVariableCallPattern = new RegExp(`\\.list\\s*\\(\\s*${name}\\s*\\)`, 'g');
        for (const match of source.matchAll(nullishVariableCallPattern)) {
          violations.push(formatLocation(file, source, match.index));
        }
      }
    }

    assert.deepEqual(violations, [], `No se permite llamar .list() sin filtros: ${violations.join(', ')}`);
  });
});
