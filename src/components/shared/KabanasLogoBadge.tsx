import clsx from 'clsx';

interface Props {
  className?: string;
}

/** Selo circular vetorial — baseado no banner promocional Boteco Kabanas Beer. */
export function KabanasLogoBadge({ className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      aria-label="Boteco Kabanas Beer"
      className={clsx('h-full w-full', className)}
    >
      <defs>
        <linearGradient id="kb-gold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f2dfa0" />
          <stop offset="45%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#8a6d1a" />
        </linearGradient>
        <radialGradient id="kb-bg" cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#1f1f1f" />
          <stop offset="100%" stopColor="#050505" />
        </radialGradient>
        <path id="kb-top-arc" d="M 34 102 A 66 66 0 0 1 166 102" />
        <path id="kb-bottom-arc" d="M 48 104 A 52 52 0 0 0 152 104" />
      </defs>

      <circle cx="100" cy="100" r="99" fill="url(#kb-bg)" />
      <circle cx="100" cy="100" r="95" stroke="url(#kb-gold)" strokeWidth="2.2" />
      <circle cx="100" cy="100" r="88" stroke="url(#kb-gold)" strokeWidth="0.9" opacity="0.55" />

      {/* Canecas brindando */}
      <g stroke="url(#kb-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M78 58v16c0 2.8 2.2 5 5 5h7V58H78z" fill="none" />
        <path d="M78 58h12v3H78z" fill="url(#kb-gold)" stroke="none" opacity="0.35" />
        <path d="M110 54l10 4v16c0 2.8-2.2 5-5 5h-7V58l2-4z" fill="none" />
        <path d="M110 54l10 4v3h-10z" fill="url(#kb-gold)" stroke="none" opacity="0.35" />
        <path d="M92 52l8 6" />
      </g>

      {/* BOTECO — arco superior */}
      <text
        fill="url(#kb-gold)"
        fontSize="10.5"
        fontFamily="var(--font-dm-sans), system-ui, sans-serif"
        fontWeight="700"
        letterSpacing="3.5"
      >
        <textPath href="#kb-top-arc" startOffset="50%" textAnchor="middle">
          BOTECO
        </textPath>
      </text>

      {/* KABANAS — fonte display do site (Rye) */}
      <text
        x="100"
        y="114"
        textAnchor="middle"
        fill="url(#kb-gold)"
        fontSize="34"
        fontFamily="var(--font-rye), Georgia, serif"
        letterSpacing="1.5"
      >
        KABANAS
      </text>

      <text
        x="100"
        y="128"
        textAnchor="middle"
        fill="url(#kb-gold)"
        fontSize="9.5"
        fontFamily="var(--font-dm-sans), system-ui, sans-serif"
        fontWeight="700"
        letterSpacing="5"
      >
        BEER
      </text>

      {/* Lúpulo + trigo */}
      <g fill="url(#kb-gold)">
        <ellipse cx="100" cy="148" rx="4.5" ry="7" />
        <path d="M96 141c1-4 2.5-6 4-6s3 2 4 6" fill="none" stroke="url(#kb-gold)" strokeWidth="1" />
        <path d="M98 143c0-2 .8-3.5 2-3.5s2 1.5 2 3.5" fill="none" stroke="#050505" strokeWidth="0.6" opacity="0.35" />
      </g>
      <g stroke="url(#kb-gold)" strokeWidth="1.1" strokeLinecap="round" fill="none">
        <path d="M72 152c3-5 6-7 9-7" />
        <path d="M74 149c2-3 4-4 6-4M76 153c1.5-2.5 3-3.5 4.5-3.5" />
        <path d="M128 152c-3-5-6-7-9-7" />
        <path d="M126 149c-2-3-4-4-6-4M124 153c-1.5-2.5-3-3.5-4.5-3.5" />
      </g>

      {/* Tagline — arco inferior */}
      <text
        fill="url(#kb-gold)"
        fontSize="6.8"
        fontFamily="var(--font-dm-sans), system-ui, sans-serif"
        fontWeight="600"
        letterSpacing="1.2"
      >
        <textPath href="#kb-bottom-arc" startOffset="50%" textAnchor="middle">
          PETISCO, CERVEJA E BOAS HISTÓRIAS
        </textPath>
      </text>
    </svg>
  );
}
