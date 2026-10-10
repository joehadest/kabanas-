import Image from 'next/image';
import clsx from 'clsx';
import { StoreLogo } from '@/components/shared/StoreLogo';
import { BRAND } from '@/lib/brand';
import { isStoreOpenNow } from '@/lib/utils/format';
import type { StoreSettings } from '@/lib/types/database';

interface Props {
  store: StoreSettings;
  orderingEnabled?: boolean;
}

export function DineInHero({ store, orderingEnabled = true }: Props) {
  const isOpen = isStoreOpenNow(store);
  const supportLine = store.tagline?.trim() || (orderingEnabled
    ? 'Escolha seus favoritos e faça seu pedido por aqui.'
    : 'Escolha seus favoritos e peça ao garçom.');

  return (
    <section className="relative isolate overflow-hidden border-b border-white/10 bg-kabanas-charcoal text-white" aria-label={`${store.name} — cardápio da mesa`}>
      <Image src={BRAND.dineInBannerPath} alt="" fill sizes="100vw" className="object-cover object-center opacity-40" preload />
      <div className="absolute inset-0 bg-gradient-to-r from-kabanas-charcoal via-kabanas-charcoal/80 to-kabanas-charcoal/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-kabanas-charcoal to-transparent" />
      <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] sm:px-8 sm:py-10">
        <div className="flex items-center gap-3 sm:gap-5">
          <StoreLogo logoUrl={store.logo_url} name={store.name} size="md" className="shadow-lg" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">Cardápio da mesa</p>
            <h1 className="mt-1 break-words font-display text-2xl leading-tight sm:text-4xl">{store.name}</h1>
          </div>
        </div>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-300">{supportLine}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1', isOpen ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/5 text-neutral-400')}>
            <span className={clsx('h-1.5 w-1.5 rounded-full', isOpen ? 'bg-emerald-400' : 'bg-neutral-500')} aria-hidden="true" />
            {isOpen ? 'Aberto agora' : 'Fechado no momento'}
          </span>
          <span className="text-neutral-400">{orderingEnabled ? 'Pedidos na mesa' : 'Cardápio para consulta'}</span>
        </div>
      </div>
    </section>
  );
}
