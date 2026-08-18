import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createDocumentObjectUrlLease,
  createDocumentViewerLifecycle,
} from '../../src/features/documents/services/documentObjectUrlLifecycle.js';

function createHarness() {
  const events = [];
  const lifecycle = createDocumentViewerLifecycle({
    createLease: ({ objectUrl, viewerWindow }) => createDocumentObjectUrlLease({
      objectUrl,
      viewerWindow,
      revokeObjectUrl: (url) => events.push(`revoke:${url}`),
    }),
  });
  lifecycle.mount();
  return { events, lifecycle };
}

function createViewer(name, events) {
  return {
    closed: false,
    close() {
      if (this.closed) return;
      this.closed = true;
      events.push(`close:${name}`);
    },
  };
}

describe('document Object URL lifecycle', () => {
  it('revoca exactamente una vez al cerrar el visor', () => {
    const revoked = [];
    const viewerWindow = { closed: false, closeCalls: 0, close() { this.closeCalls += 1; this.closed = true; } };
    const lease = createDocumentObjectUrlLease({
      objectUrl: 'blob:document-1',
      viewerWindow,
      revokeObjectUrl: (url) => revoked.push(url),
    });

    lease.release({ closeWindow: true });
    lease.release({ closeWindow: true });

    assert.deepEqual(revoked, ['blob:document-1']);
    assert.equal(viewerWindow.closeCalls, 1);
    assert.equal(lease.released, true);
  });

  it('permite liberar memoria sin cerrar una ventana ya cerrada', () => {
    const revoked = [];
    const viewerWindow = { closed: true, closeCalls: 0, close() { this.closeCalls += 1; } };
    const lease = createDocumentObjectUrlLease({
      objectUrl: 'blob:document-2',
      viewerWindow,
      revokeObjectUrl: (url) => revoked.push(url),
    });

    lease.release({ closeWindow: true });

    assert.deepEqual(revoked, ['blob:document-2']);
    assert.equal(viewerWindow.closeCalls, 0);
  });
});

describe('document viewer request lifecycle', () => {
  it('ignora dos aperturas simultáneas que terminan en orden inverso', () => {
    const { events, lifecycle } = createHarness();
    const first = lifecycle.startRequest(createViewer('first', events));
    const second = lifecycle.startRequest(createViewer('second', events));

    const secondLease = second.activate('blob:second');
    const staleLease = first.activate('blob:first');

    assert.ok(secondLease);
    assert.equal(staleLease, null);
    assert.deepEqual(events, ['close:first', 'revoke:blob:first']);
  });

  it('libera la descarga que termina después del desmontaje', () => {
    const { events, lifecycle } = createHarness();
    const pending = lifecycle.startRequest(createViewer('pending', events));

    lifecycle.dispose();
    assert.deepEqual(events, ['close:pending']);
    const staleLease = pending.activate('blob:pending');

    assert.equal(staleLease, null);
    assert.deepEqual(events, ['close:pending', 'revoke:blob:pending']);
  });

  it('sustituye normalmente el visor y revoca la URL anterior', () => {
    const { events, lifecycle } = createHarness();
    const first = lifecycle.startRequest(createViewer('first', events));
    assert.ok(first.activate('blob:first'));

    const second = lifecycle.startRequest(createViewer('second', events));
    assert.ok(second.activate('blob:second'));

    assert.deepEqual(events, ['close:first', 'revoke:blob:first']);
  });

  it('no ejecuta actualizaciones después del desmontaje', () => {
    const { lifecycle } = createHarness();
    const pending = lifecycle.startRequest(createViewer('pending', []));
    let updates = 0;

    lifecycle.dispose();
    const updated = pending.runIfCurrent(() => { updates += 1; });

    assert.equal(updated, false);
    assert.equal(updates, 0);
  });
});
