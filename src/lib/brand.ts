/** Identidade visual Boteco Kabanas Beer — alinhada ao banner promocional. */
export const BRAND = {
  name: 'Boteco Kabanas Beer',
  shortName: 'Kabanas',
  tagline: 'Petisco, cerveja e boas histórias',
  heroTagline: 'O melhor chopp da cidade',
  deliveryTagline: 'Chopp gelado, petiscos na brasa e delivery quentinho.',
  logoBadgePath: '/brand/logo-badge.svg',
  logoBadgePng: {
    16: '/brand/logo-badge-16.png',
    32: '/brand/logo-badge-32.png',
    180: '/brand/logo-badge-180.png',
    192: '/brand/logo-badge-192.png',
    512: '/brand/logo-badge-512.png',
  },
  bannerPath: '/brand/banner-promo.jpg',
  /** Banner exclusivo do cardápio presencial (mesa / QR). */
  dineInBannerPath: '/brand/banner-dine-in.png',
  colors: {
    charcoal: '#0a0a0a',
    dark: '#1a1a1a',
    ink: '#f5f5f5',
    gold: '#d4af37',
    goldLight: '#f2dfa0',
    goldDark: '#8a6d1a',
  },
} as const;
