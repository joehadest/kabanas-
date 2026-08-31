'use client';

import { useEffect } from 'react';
import { useCartStore } from '@/lib/store/cart-store';

/**
 * Dispara a reidratação do carrinho (localStorage) depois que a hidratação
 * do React já terminou. Ver skipHydration em cart-store.ts.
 */
export function CartHydration() {
  useEffect(() => {
    useCartStore.persist.rehydrate();
  }, []);

  return null;
}
