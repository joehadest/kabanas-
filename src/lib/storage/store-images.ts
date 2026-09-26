import type { SupabaseClient } from '@supabase/supabase-js';
import { PRODUCT_IMAGES_BUCKET, productImagePathFromUrl } from '@/lib/storage/product-images';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 1200;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

/**
 * Redimensiona mantendo proporção (sem crop quadrado) — adequado para logos alongadas.
 */
export async function prepareStoreImageFile(file: File): Promise<File> {
  if (!ALLOWED.has(file.type) && !file.type.startsWith('image/')) {
    throw new Error('Use uma imagem (JPG, PNG, WEBP ou HEIC).');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }

  if (file.type === 'image/heic' || file.type === 'image/heif' || file.type === 'image/gif') {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_SIDE ? MAX_SIDE / longest : 1;
  const outW = Math.max(1, Math.round(bitmap.width * scale));
  const outH = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, outW, outH);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, '') || 'logo';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

export async function uploadStoreImage(
  supabase: SupabaseClient,
  file: File,
  storeId: string
): Promise<string> {
  const prepared = typeof document !== 'undefined' ? await prepareStoreImageFile(file) : file;

  if (prepared.size > MAX_BYTES) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }

  const path = `${storeId}/brand/${crypto.randomUUID()}.jpg`;
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

export async function removeStoreImage(supabase: SupabaseClient, url: string | null | undefined) {
  const path = productImagePathFromUrl(url);
  if (!path || !path.includes('/brand/')) return;
  await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
}
