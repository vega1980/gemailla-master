export function createDocumentObjectUrlLease({ objectUrl, viewerWindow, revokeObjectUrl = URL.revokeObjectURL.bind(URL) }) {
  if (!objectUrl) throw new Error('Se requiere un Object URL para administrar el visor.');

  let released = false;

  return {
    get released() {
      return released;
    },
    release({ closeWindow = false } = {}) {
      if (released) return;
      released = true;

      if (closeWindow && viewerWindow && !viewerWindow.closed) {
        viewerWindow.close();
      }

      revokeObjectUrl(objectUrl);
    },
  };
}

export function createDocumentViewerLifecycle({ createLease = createDocumentObjectUrlLease } = {}) {
  let mounted = false;
  let latestRequestId = 0;
  let activeLease = null;
  const pendingWindows = new Set();

  const releaseLease = (lease, options) => {
    if (!lease) return;
    lease.release(options);
    if (activeLease === lease) activeLease = null;
  };

  return {
    mount() {
      mounted = true;
    },
    startRequest(viewerWindow) {
      const requestId = ++latestRequestId;
      let ownLease = null;
      let pending = true;

      const isCurrent = () => mounted && requestId === latestRequestId;
      const closeOwnWindow = () => {
        if (viewerWindow && !viewerWindow.closed) viewerWindow.close();
      };
      const finishPending = () => {
        if (!pending) return;
        pending = false;
        pendingWindows.delete(closeOwnWindow);
      };
      pendingWindows.add(closeOwnWindow);

      return {
        isCurrent,
        runIfCurrent(callback) {
          if (!isCurrent()) return false;
          callback();
          return true;
        },
        activate(objectUrl) {
          finishPending();
          ownLease = createLease({ objectUrl, viewerWindow });
          if (!isCurrent()) {
            releaseLease(ownLease, { closeWindow: true });
            return null;
          }

          const previousLease = activeLease;
          activeLease = ownLease;
          releaseLease(previousLease, { closeWindow: true });
          return ownLease;
        },
        release(options = { closeWindow: true }) {
          finishPending();
          if (ownLease) {
            releaseLease(ownLease, options);
          } else {
            closeOwnWindow();
          }
        },
      };
    },
    release(lease, options) {
      releaseLease(lease, options);
    },
    dispose() {
      mounted = false;
      latestRequestId += 1;
      pendingWindows.forEach((closeWindow) => closeWindow());
      pendingWindows.clear();
      releaseLease(activeLease, { closeWindow: true });
    },
  };
}
