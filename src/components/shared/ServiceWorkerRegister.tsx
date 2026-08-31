'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => registration.update())
        .catch((err) => {
          console.error('[SW] falha ao registrar:', err);
        });
    });
  }, []);

  return null;
}
