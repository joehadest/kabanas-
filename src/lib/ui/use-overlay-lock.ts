'use client';

import { useEffect } from 'react';
import { acquireOverlayLock } from '@/lib/ui/overlay-lock';

/** Mantém o lock global enquanto `active` for true (modais, sheets, dialogs). */
export function useOverlayLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return acquireOverlayLock();
  }, [active]);
}
