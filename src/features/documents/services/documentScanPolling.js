const terminalScanStatuses = new Set(['clean', 'rejected', 'scan_error']);

export function shouldPollDocumentScan(document) {
  if (document?.status === 'uploading') return true;
  return document?.status === 'quarantined'
    && !terminalScanStatuses.has(document?.scanStatus);
}
