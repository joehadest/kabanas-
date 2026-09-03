type OverlayListener = (openCount: number) => void;

let openCount = 0;
let previousBodyOverflow = '';
const listeners = new Set<OverlayListener>();

function syncBodyScroll() {
  if (typeof document === 'undefined') return;
  if (openCount > 0) {
    document.documentElement.dataset.overlayOpen = String(openCount);
    if (openCount === 1) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
  } else {
    delete document.documentElement.dataset.overlayOpen;
    document.body.style.overflow = previousBodyOverflow;
    previousBodyOverflow = '';
  }
}

function notify() {
  syncBodyScroll();
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
