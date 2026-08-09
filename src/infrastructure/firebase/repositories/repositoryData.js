// @ts-check

import { Timestamp } from 'firebase/firestore';

/** @param {Record<string, unknown>} data */
export function serializeRepositoryData(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value instanceof Timestamp ? value.toDate().toISOString() : value,
    ]),
  );
}

/** @param {Record<string, unknown>} data */
export function stripRepositoryDocumentId(data) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'id'));
}
