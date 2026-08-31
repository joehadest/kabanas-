import Image from 'next/image';
import clsx from 'clsx';
import { StoreLogo } from '@/components/shared/StoreLogo';
import { formatCurrency, isStoreOpenNow } from '@/lib/utils/format';
import type { StoreSettings } from '@/lib/types/database';

interface Props {
  store: StoreSettings;
}

const DEFAULT_TAGLINE = 'Peça sua comida favorita com entrega rápida.';

export function Hero({ store }: Props) {
  const isOpen = isStoreOpenNow(store);
  const feeLabel =
    store.delivery_fee_type === 'fixed'
      ? store.delivery_fee_fixed === 0
        ? 'Entrega grátis'
        : `Entrega ${formatCurrency(store.delivery_fee_fixed)}`
      : `A partir de ${formatCurrency(store.delivery_fee_per_km)}/km`;

  return (
    <section className="relative overflow-hidden bg-[#171612] pb-5 text-white">
      <div className="relative h-[19rem] w-full overflow-hidden sm:h-[24rem]">
        {store.banner_url && (
          <>
            <Image src={store.banner_url} alt="" fill sizes="100vw" className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-[#171612] via-[#171612]/45 to-black/10" />
          </>
        )}
        {!store.banner_url && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,#eab308_0,transparent_23%),radial-gradient(circle_at_83%_10%,#43310c_0,transparent_28%),linear-gradient(135deg,#28251a_0%,#171612_68%)]" />
        )}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent" />
        <div className="absolute right-4 top-4 safe-top sm:right-8">
          <span
            className={clsx(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] shadow-lg backdrop-blur-md',
              isOpen ? 'border-brand-300/60 bg-brand-400 text-neutral-950' : 'border-white/15 bg-black/35 text-white'
            )}
          >
            <span className={clsx('h-1.5 w-1.5 rounded-full', isOpen ? 'bg-neutral-950' : 'bg-neutral-400')} />
            {isOpen ? 'Aberto agora' : 'Fechado no momento'}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-5 pb-9 sm:px-8 sm:pb-12">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-300">Delivery que chega quente</p>
          <h1 className="max-w-2xl font-serif text-4xl font-bold leading-[0.95] tracking-tight text-white sm:text-6xl">
            {store.name}
          </h1>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-7 max-w-6xl px-5 sm:-mt-9 sm:px-8">
        <div className="flex items-end gap-3">
          <StoreLogo
            logoUrl={store.logo_url}
            name={store.name}
            size="lg"
            className="border-4 border-[#171612] shadow-[0_12px_30px_rgba(0,0,0,0.34)]"
          />
          <span className="mb-2 text-xs font-medium text-neutral-300">Cardapio digital</span>
        </div>

        <div className="mt-5 grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <p className="max-w-xl text-sm leading-relaxed text-neutral-300 sm:text-base">{store.tagline || DEFAULT_TAGLINE}</p>

          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-brand-400 px-3 py-1.5 text-neutral-950">{feeLabel}</span>
            {store.min_order_value > 0 && (
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white">
                Minimo {formatCurrency(store.min_order_value)}
              </span>
            )}
            {store.address_city && (
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white">
                {store.address_city}/{store.address_state}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
