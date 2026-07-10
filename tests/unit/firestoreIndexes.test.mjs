import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { ENTITY_COLLECTIONS } from '../../src/infrastructure/firebase/repositories/entityCollections.js';

const [firestoreIndexes, companyEntityQueriesSource] = await Promise.all([
  readFile(new URL('../../firestore.indexes.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../../src/lib/companyEntityQueries.js', import.meta.url), 'utf8'),
]);

const companyEntityQueryPattern = /\n\s*(\w+):\s*\{\s*entity:\s*'([^']+)',\s*orderBy:\s*'([^']+)'/g;
const companyEntityQueries = [...companyEntityQueriesSource.matchAll(companyEntityQueryPattern)]
  .map(([, queryName, entity, orderBy]) => ({ queryName, entity, orderBy }));

const orderByToIndexField = (orderBy) => {
  const direction = orderBy.startsWith('-') ? 'DESCENDING' : 'ASCENDING';
  const fieldPath = orderBy.replace(/^-/, '');
  return { fieldPath, order: direction };
};

const hasCompanyOrderedIndex = (collectionGroup, orderBy) => {
  const orderedField = orderByToIndexField(orderBy);

  return firestoreIndexes.indexes.some((index) => (
    index.collectionGroup === collectionGroup
    && index.queryScope === 'COLLECTION'
    && index.fields.length === 2
    && index.fields[0].fieldPath === 'companyId'
    && index.fields[0].order === 'ASCENDING'
    && index.fields[1].fieldPath === orderedField.fieldPath
    && index.fields[1].order === orderedField.order
  ));
};

describe('índices Firestore para queries por compañía', () => {
  it('declara un índice companyId + orderBy para cada COMPANY_ENTITY_QUERIES', () => {
    assert.notEqual(companyEntityQueries.length, 0, 'No se pudieron leer las queries de compañía.');

    const missingIndexes = companyEntityQueries
      .map(({ queryName, entity, orderBy }) => ({
        queryName,
        collectionGroup: ENTITY_COLLECTIONS[entity],
        orderBy,
      }))
      .filter(({ collectionGroup, orderBy }) => !hasCompanyOrderedIndex(collectionGroup, orderBy));

    assert.deepEqual(missingIndexes, []);
  });
});
