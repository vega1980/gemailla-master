import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldPollDocumentScan } from '../../src/features/documents/services/documentScanPolling.js';

describe('document scan polling', () => {
  it('continues while upload or quarantine scanning is active', () => {
    assert.equal(shouldPollDocumentScan({ status: 'uploading' }), true);
    assert.equal(shouldPollDocumentScan({ status: 'quarantined' }), true);
    assert.equal(shouldPollDocumentScan({ status: 'quarantined', scanStatus: 'processing' }), true);
  });

  it('stops for every terminal quarantine outcome', () => {
    for (const scanStatus of ['clean', 'rejected', 'scan_error']) {
      assert.equal(shouldPollDocumentScan({ status: 'quarantined', scanStatus }), false);
    }
    assert.equal(shouldPollDocumentScan({ status: 'uploaded', scanStatus: 'clean' }), false);
  });
});
