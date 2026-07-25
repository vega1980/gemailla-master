import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { scanContent } from '../../scripts/check-no-hardcoded-secrets.js';

describe('check-no-hardcoded-secrets', () => {
  it('detecta claves tipo sk- sin usar claves reales', () => {
    const findings = scanContent({
      filePath: 'fixture-openai.js',
      content: "const OPENAI_API_KEY = 'sk-proj-abcDEF1234567890ghiJKLmnopqrst';\n",
    });

    assert.equal(findings.length, 2);
    assert.deepEqual(findings.map((finding) => finding.name), [
      'Clave de proveedor LLM con formato OpenAI',
      'Asignación literal de clave OpenAI',
    ]);
  });

  it('detecta claves tipo AIza sin usar claves reales', () => {
    const findings = scanContent({
      filePath: 'fixture-google.js',
      content: "const GOOGLE_API_KEY = 'AIzaSyDUMMY1234567890abcdefghijklmn';\n",
    });

    assert.equal(findings.length, 2);
    assert.deepEqual(findings.map((finding) => finding.name), [
      'Clave Google API con formato AIza',
      'Asignación literal de clave Google API',
    ]);
  });

  it('reporta la línea correcta para hallazgos posteriores', () => {
    const findings = scanContent({
      filePath: 'fixture-lines.js',
      content: "const safeValue = 'ok';\nconst GEMINI_API_KEY = 'AIzaSyDUMMY1234567890abcdefghijklmn';\n",
    });

    assert.equal(findings.every((finding) => finding.line === 2), true);
  });
});
