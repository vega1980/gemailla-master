import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSpreadsheetFile, validateRequiredColumns } from '../../src/features/imports/spreadsheetImport.js';

function csvFile(name, content) {
  return {
    name,
    async text() {
      return content;
    },
  };
}

describe('importador de hojas de cálculo', () => {
  it('normaliza BOM UTF-8 en encabezados CSV exportados por Excel', async () => {
    const rows = await parseSpreadsheetFile(csvFile('clientes.csv', '\uFEFFname,email\nCliente Demo,demo@example.com'));

    assert.deepEqual(validateRequiredColumns(rows, ['name']), []);
    assert.equal(rows[0].name, 'Cliente Demo');
    assert.equal(rows[0].email, 'demo@example.com');
  });

  it('omite columnas sin encabezado sin crear claves vacías en filas importadas', async () => {
    const rows = await parseSpreadsheetFile(csvFile('clientes.csv', ',name,email\nIGNORAR,Cliente Demo,demo@example.com'));

    assert.deepEqual(Object.keys(rows[0]), ['name', 'email']);
    assert.equal(rows[0].name, 'Cliente Demo');
  });
});
