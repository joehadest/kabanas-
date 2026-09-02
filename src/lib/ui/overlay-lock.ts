type OverlayListener = (openCount: number) => void;

let openCount = 0;
const listeners = new Set<OverlayListener>();

function notify() {
  if (typeof document !== 'undefined') {
    if (openCount > 0) {
      document.documentElement.dataset.overlayOpen = String(openCount);
    } else {
      delete document.documentElement.dataset.overlayOpen;
    }
  }
  listeners.forEach((listener) => listener(openCount));
}

/** Registra um overlay/modal aberto. Retorna release para cleanup. */
export function acquireOverlayLock() {
  openCount += 1;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openCount = Math.max(0, openCount - 1);
    notify();
  };
}

export function isOverlayLocked() {
  return openCount > 0;
}

export function subscribeOverlayLock(listener: OverlayListener) {
  listeners.add(listener);
  listener(openCount);
  return () => {
    listeners.delete(listener);
  };
}
