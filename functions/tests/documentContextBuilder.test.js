const assert = require('node:assert/strict');
const test = require('node:test');
const admin = require('firebase-admin');

const { buildDocumentContext } = require('../handlers/documentContextBuilder');

test('DCB-3 rejects a document storagePath from another company before Admin SDK download', async () => {
  const document = {
    id: 'doc-cross-tenant',
    companyId: 'empresa-a',
    storagePath: 'companies/empresa-b/documents/private.pdf',
  };

  await assert.rejects(
    () => buildDocumentContext([document]),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.message, 'storagePath fuera del prefijo autorizado de la empresa.');
      return true;
    },
  );
});

test('DCB-3 allows same-company storagePath and proceeds to Storage download', async (t) => {
  const requestedPaths = [];
  let metadataCalls = 0;
  let downloadCalls = 0;

  Object.defineProperty(admin, 'storage', {
    configurable: true,
    value: () => ({
      bucket: () => ({
        file: (storagePath) => {
          requestedPaths.push(storagePath);
          return {
            getMetadata: async () => {
              metadataCalls += 1;
              return [{
                size: '20',
                contentType: 'text/plain',
                name: storagePath,
              }];
            },
            download: async (options) => {
              downloadCalls += 1;
              assert.deepEqual(options, { validation: 'crc32c' });
              return [Buffer.from('contexto permitido', 'utf8')];
            },
          };
        },
      }),
    }),
  });
  t.after(() => {
    delete admin.storage;
  });

  const context = await buildDocumentContext([{
    id: 'doc-legitimo',
    companyId: 'empresa-a',
    storagePath: 'companies/empresa-a/documents/legitimo.txt',
    title: 'Documento legítimo',
  }]);

  assert.deepEqual(requestedPaths, ['companies/empresa-a/documents/legitimo.txt']);
  assert.equal(metadataCalls, 1);
  assert.equal(downloadCalls, 1);
  assert.match(context, /contexto permitido/);
});
