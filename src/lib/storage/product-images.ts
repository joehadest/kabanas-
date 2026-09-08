import type { SupabaseClient } from '@supabase/supabase-js';

export const PRODUCT_IMAGES_BUCKET = 'product-images';
const MAX_BYTES = 5 * 1024 * 1024;
const OUTPUT_SIZE = 1200;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

/** Extrai o path no bucket a partir da URL pública do Supabase Storage. */
export function productImagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/object/public/${PRODUCT_IMAGES_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0] || '') || null;
}

/**
 * Recorta o centro em quadrado e redimensiona.
 * Assim os cards usam object-cover sem faixa de fundo e sem “zoom” estranho.
 */
export async function prepareProductImageFile(file: File): Promise<File> {
  if (!ALLOWED.has(file.type) && !file.type.startsWith('image/')) {
    throw new Error('Use uma imagem (JPG, PNG, WEBP ou HEIC).');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }

  // HEIC/GIF: envia original (canvas pode falhar no browser)
  if (file.type === 'image/heic' || file.type === 'image/heif' || file.type === 'image/gif') {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.floor((bitmap.width - side) / 2);
  const sy = Math.floor((bitmap.height - side) / 2);
  const out = Math.min(OUTPUT_SIZE, side);

  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, '') || 'produto';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

export async function uploadProductImage(
  supabase: SupabaseClient,
  file: File,
  storeId: string
): Promise<string> {
  const prepared = typeof document !== 'undefined' ? await prepareProductImageFile(file) : file;

  if (prepared.size > MAX_BYTES) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }

  const path = `${storeId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, prepared, {
    cacheControl: '31536000',
    upsert: false,
    contentType: prepared.type || 'image/jpeg',
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível enviar a imagem.');
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function removeProductImage(supabase: SupabaseClient, url: string | null | undefined) {
  const path = productImagePathFromUrl(url);
  if (!path) return;
  await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
}
