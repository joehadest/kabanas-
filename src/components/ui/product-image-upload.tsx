'use client';

import { useRef, useState } from 'react';
import { ImageOff, ImagePlus, Link2, Loader2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { removeProductImage, uploadProductImage } from '@/lib/storage/product-images';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface Props {
  storeId: string;
  value: string;
  onChange: (url: string) => void;
  className?: string;
  /** Compacto (ex.: linha ao lado do nome) vs bloco completo. */
  variant?: 'card' | 'inline';
}

export function ProductImageUpload({ storeId, value, onChange, className, variant = 'card' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    const previous = value.trim() || null;
    try {
      const supabase = createClient();
      const url = await uploadProductImage(supabase, file, storeId);
      onChange(url);
      if (previous && previous !== url) {
        void removeProductImage(supabase, previous);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = async () => {
    setError(null);
    const previous = value.trim() || null;
    onChange('');
    if (previous) {
      try {
        await removeProductImage(createClient(), previous);
      } catch {
        /* ignore — URL já removida do form */
      }
    }
  };

  const preview = value.trim();

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-border bg-neutral-900',
          variant === 'inline' ? 'flex items-stretch gap-3 p-2' : 'flex flex-col'
        )}
      >
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden bg-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-60',
            variant === 'inline' ? 'h-20 w-20 rounded-xl' : 'aspect-square w-full max-w-[14rem] sm:max-w-[16rem]'
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1.5 px-3 text-neutral-500">
              <ImagePlus size={variant === 'inline' ? 22 : 28} />
              {variant !== 'inline' && (
                <span className="text-[11px] font-bold uppercase tracking-wide">Toque para adicionar foto</span>
              )}
            </span>
          )}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/55">
              <Loader2 size={22} className="animate-spin text-brand-300" />
            </span>
          )}
        </button>

        <div className={cn('flex min-w-0 flex-1 flex-col justify-center gap-2', variant === 'card' && 'p-3')}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={pick}
              disabled={uploading}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-400/40 bg-brand-400/10 px-3 text-xs font-bold text-brand-300 transition-colors hover:bg-brand-400/20 disabled:opacity-50"
            >
              <Upload size={14} />
              {preview ? 'Trocar foto' : 'Enviar foto'}
            </button>
            {preview && (
              <button
                type="button"
                onClick={() => void clear()}
                disabled={uploading}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              >
                <ImageOff size={14} />
                Remover
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowLink((v) => !v)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold text-neutral-400 transition-colors hover:bg-white/5 hover:text-ink"
            >
              <Link2 size={14} />
              {showLink ? 'Ocultar link' : 'Usar link'}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-500">
            A foto é enquadrada em quadrado automaticamente · JPG/PNG/WEBP · até 5&nbsp;MB
          </p>
        </div>
      </div>

      {showLink && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          inputMode="url"
          className="min-h-11"
        />
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
