import Image from 'next/image';
import clsx from 'clsx';
import { KabanasLogo } from '@/components/shared/KabanasLogo';
import { StoreLogo } from '@/components/shared/StoreLogo';
import { BRAND } from '@/lib/brand';
import { isStoreOpenNow } from '@/lib/utils/format';
import type { StoreSettings } from '@/lib/types/database';

interface Props {
  store: StoreSettings;
  /** Quando false, o cardápio é só para visualização: troca as mensagens de "peça" por "consulte". */
  orderingEnabled?: boolean;
}

/**
 * Hero exclusivo do cardápio presencial (QR / mesa).
 * Composição de boteco: banner full-bleed, marca em primeiro plano,
 * convite curto para pedir na mesa — sem taxas, pills ou overlays soltos.
 */
export function DineInHero({ store, orderingEnabled = true }: Props) {
  const isOpen = isStoreOpenNow(store);
  const hasCustomLogo = Boolean(store.logo_url);
  const supportLine =
    store.tagline?.trim() ||
    (orderingEnabled
      ? 'Escolha os itens e envie o pedido direto para a cozinha.'
      : 'Veja os produtos e preços — peça ao garçom para fazer seu pedido.');

  return (
    <section className="relative overflow-hidden bg-kabanas-charcoal text-white" aria-label={`${BRAND.shortName} — cardápio da mesa`}>
      {/* Plano visual dominante */}
      <div className="relative isolate min-h-[16rem] w-full sm:min-h-[20rem] lg:min-h-[22rem]">
        <Image
          src={BRAND.dineInBannerPath}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center opacity-65 motion-safe:animate-ken-slow sm:opacity-60"
          priority
        />

        {/* Atmosfera: vinheta + ouro suave */}
        <div className="absolute inset-0 bg-gradient-to-t from-kabanas-charcoal via-kabanas-charcoal/80 to-kabanas-charcoal/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-kabanas-charcoal/50 via-transparent to-kabanas-charcoal/50" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_85%,rgba(212,175,55,0.16)_0,transparent_50%)]" />

        {/* Conteúdo ancorado na base — leitura de “entrada do boteco” */}
        <div className="relative z-10 mx-auto flex min-h-[16rem] max-w-6xl flex-col items-center justify-end px-5 pb-8 pt-12 text-center safe-top sm:min-h-[20rem] sm:px-8 sm:pb-10 sm:pt-14 lg:min-h-[22rem]">
          <div className="animate-fade-in-up">
            {hasCustomLogo ? (
              <StoreLogo
                logoUrl={store.logo_url}
                name={store.name}
                size="lg"
                className="mb-4 ring-2 ring-brand-400/40 shadow-[0_0_32px_rgba(212,175,55,0.28)] sm:mb-5"
              />
            ) : (
              <KabanasLogo
                variant="badge"
                size="xl"
                className="mb-4 drop-shadow-[0_8px_28px_rgba(0,0,0,0.55)] sm:mb-5"
              />
            )}
          </div>

          <p className="animate-fade-in-up text-[10px] font-bold uppercase tracking-[0.28em] text-brand-300 [animation-delay:50ms] sm:text-[11px]">
            Cardápio da mesa
          </p>

          <h1 className="mt-2 max-w-3xl animate-fade-in-up font-display text-[2.5rem] leading-[0.95] tracking-wide text-white [animation-delay:90ms] sm:mt-3 sm:text-5xl lg:text-6xl">
            {BRAND.shortName}
          </h1>

          {/* Régua dourada — assinatura visual do boteco */}
          <div
            className="mt-4 h-px w-16 animate-fade-in-up bg-gradient-to-r from-transparent via-brand-400 to-transparent [animation-delay:130ms] sm:mt-5 sm:w-24"
            aria-hidden
          />

          <p className="mt-4 max-w-sm animate-fade-in-up text-sm leading-relaxed text-neutral-200 [animation-delay:160ms] sm:max-w-md sm:text-[15px]">
            {supportLine}
          </p>

          <p
            className={clsx(
              'mt-5 inline-flex animate-fade-in-up items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] [animation-delay:200ms]',
              isOpen ? 'text-brand-300' : 'text-neutral-500'
            )}
          >
            <span
              className={clsx(
                'h-1.5 w-1.5 rounded-full',
                isOpen ? 'bg-brand-400 shadow-[0_0_8px_rgba(212,175,55,0.8)]' : 'bg-neutral-600'
              )}
              aria-hidden
            />
            {isOpen
              ? orderingEnabled
                ? 'Aberto agora · peça à vontade'
                : 'Aberto agora · cardápio para consulta'
              : 'Fechado no momento'}
          </p>
        </div>
      </div>
    </section>
  );
}
