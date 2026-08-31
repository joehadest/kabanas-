import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { StoreSettings } from '@/lib/types/database';

/**
 * Busca a loja ativa (por NEXT_PUBLIC_STORE_SLUG). Envolvida em `cache()` do
 * React para deduplicar a query dentro do mesmo request — layout.tsx e a
 * página atual podem chamar isso sem gerar duas consultas ao Supabase.
 */
export const getActiveStore = cache(async (): Promise<StoreSettings | null> => {
  const supabase = await createClient();
  const slug = process.env.NEXT_PUBLIC_STORE_SLUG ?? 'kabanas';

  const { data } = await supabase.from('store_settings').select('*').eq('slug', slug).single<StoreSettings>();

  return data ?? null;
});
