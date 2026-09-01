import Image from 'next/image';
import clsx from 'clsx';
import { KabanasLogo } from '@/components/shared/KabanasLogo';
import { StoreLogo } from '@/components/shared/StoreLogo';
import { BRAND } from '@/lib/brand';
import { formatCurrency, isStoreOpenNow } from '@/lib/utils/format';
import type { StoreSettings } from '@/lib/types/database';

interface Props {
  store: StoreSettings;
}

export function Hero({ store }: Props) {
  const isOpen = isStoreOpenNow(store);
  const hasCustomLogo = Boolean(store.logo_url);
  const feeLabel =
    store.delivery_fee_type === 'fixed'
      ? store.delivery_fee_fixed === 0
        ? 'Entrega grátis'
        : `Entrega ${formatCurrency(store.delivery_fee_fixed)}`
      : `A partir de ${formatCurrency(store.delivery_fee_per_km)}/km`;

  return (
    <section className="relative overflow-hidden bg-kabanas-charcoal pb-6 text-white">
      <div className="relative min-h-[24rem] w-full overflow-hidden sm:min-h-[28rem]">
        <Image
          src={BRAND.bannerPath}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-top opacity-35"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-kabanas-charcoal/70 via-kabanas-charcoal/85 to-kabanas-charcoal" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(212,175,55,0.12)_0,transparent_45%)]" />

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

        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-5 pb-10 pt-10 text-center sm:px-8 sm:pb-14 sm:pt-14">
          {hasCustomLogo ? (
            <StoreLogo
              logoUrl={store.logo_url}
              name={store.name}
              size="lg"
              className="mb-5 shadow-glow-lg ring-4 ring-brand-400/30 sm:mb-6"
            />
          ) : (
            <KabanasLogo variant="badge" size="hero" className="mb-5 sm:mb-6" showTagline />
          )}

          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-300">
            {BRAND.heroTagline}
          </p>

          <h1 className="mt-3 max-w-2xl font-display text-4xl leading-none tracking-wide text-white sm:text-6xl">
            {store.name}
          </h1>

          <p className="mt-4 max-w-lg text-sm leading-relaxed text-neutral-300 sm:text-base">
            {store.tagline || BRAND.deliveryTagline}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-brand-400 px-3 py-1.5 text-neutral-950">{feeLabel}</span>
            {store.min_order_value > 0 && (
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white">
                Mínimo {formatCurrency(store.min_order_value)}
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
