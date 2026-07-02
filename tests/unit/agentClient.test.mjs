import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildProactiveAccountingActions,
  detectMissingSupplierInvoices,
  draftSupplierInvoiceEmail,
} from '../../src/api/agentClient.js';

describe('agentClient proactive accounting', () => {
  it('detects supplier expense transactions without matching XML/PDF invoice', () => {
    const missing = detectMissingSupplierInvoices({
      transactions: [
        { id: 'tx-1', type: 'gasto', amount: 1500, counterparty: 'Proveedor Norte', providerEmail: 'facturas@norte.test', date: '2026-07-01' },
        { id: 'tx-2', type: 'gasto', amount: 999, counterparty: 'Proveedor Cubierto' },
        { id: 'tx-3', type: 'ingreso', amount: 300, counterparty: 'Cliente' },
      ],
      documents: [
        { id: 'doc-1', title: 'factura.xml', size: 1200, supplierName: 'Proveedor Cubierto', total: 999, docType: 'factura' },
        { id: 'doc-2', title: 'archivo-grande.pdf', size: 16 * 1024 * 1024, supplierName: 'Proveedor Norte', total: 1500, docType: 'factura' },
      ],
    });

    assert.deepEqual(missing, [{
      transactionId: 'tx-1',
      supplierName: 'Proveedor Norte',
      supplierEmail: 'facturas@norte.test',
      amount: 1500,
      date: '2026-07-01',
      description: '',
    }]);
  });

  it('builds pending approval email actions instead of sending automatically', () => {
    const actions = buildProactiveAccountingActions({
      company: { name: 'Mi Empresa', currency: 'MXN' },
      transactions: [{ id: 'tx-1', type: 'expense', amount: 250, vendorName: 'Servicios Delta', vendorEmail: 'cobranza@delta.test' }],
      documents: [],
    });

    assert.equal(actions.length, 1);
    assert.equal(actions[0].status, 'pending_approval');
    assert.equal(actions[0].type, 'request_missing_supplier_invoice');
    assert.equal(actions[0].emailDraft.to, 'cobranza@delta.test');
    assert.match(actions[0].emailDraft.body, /sin factura XML\/PDF conciliada/);
  });

  it('drafts a supplier invoice request email', () => {
    const draft = draftSupplierInvoiceEmail({ supplierName: 'ACME', amount: 10, date: '2026-07-02' }, { name: 'Gemailla Demo', currency: 'MXN' });

    assert.equal(draft.subject, 'Solicitud de factura pendiente - Gemailla Demo');
    assert.match(draft.body, /ACME/);
    assert.match(draft.body, /2026-07-02/);
  });
});
