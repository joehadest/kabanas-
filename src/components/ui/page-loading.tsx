export function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <p className="mb-6 text-sm text-neutral-400">Carregando página…</p>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-white/10" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 rounded-2xl border border-white/5 bg-white/5" />
          ))}
        </div>
        <div className="h-64 rounded-2xl border border-white/5 bg-white/5" />
      </div>
    </div>
  );
}
