'use client';

import { useRef, useState } from 'react';
import { ImageOff, ImagePlus, Link2, Loader2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { uploadStoreImage } from '@/lib/storage/store-images';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface Props {
  storeId: string;
  value: string;
  onChange: (url: string) => void;
  className?: string;
  label?: string;
}

export function StoreImageUpload({
  storeId,
  value,
  onChange,
  className,
  label = 'Logo da loja',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const url = await uploadStoreImage(supabase, file, storeId);
      // Não remove a imagem antiga aqui — o form só persiste logo_url no save.
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = () => {
    setError(null);
    // Só limpa o form; Storage é limpo após save bem-sucedido.
    onChange('');
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

      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-neutral-900 sm:flex-row sm:items-stretch">
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className="relative flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden bg-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-60 sm:aspect-auto sm:h-36 sm:w-44"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-contain p-3" />
          ) : (
            <span className="flex flex-col items-center gap-1.5 px-3 text-neutral-500">
              <ImagePlus size={28} />
              <span className="text-[11px] font-bold uppercase tracking-wide">Toque para adicionar</span>
            </span>
          )}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/55">
              <Loader2 size={22} className="animate-spin text-brand-300" />
            </span>
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">{label}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={pick}
              disabled={uploading}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-400/40 bg-brand-400/10 px-3 text-xs font-bold text-brand-300 transition-colors hover:bg-brand-400/20 disabled:opacity-50"
            >
              <Upload size={14} />
              {preview ? 'Trocar logo' : 'Enviar logo'}
            </button>
            {preview && (
              <button
                type="button"
                onClick={clear}
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
            Proporção original preservada · JPG/PNG/WEBP · até 5&nbsp;MB
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
