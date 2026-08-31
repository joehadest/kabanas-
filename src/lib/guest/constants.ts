/** Cookie que identifica um visitante sem conta (checkout de convidado). */
export const GUEST_ID_COOKIE = 'kabanas_guest_id';

/** Header enviado em toda chamada ao Supabase para carregar o guest_id nas policies de RLS. */
export const GUEST_ID_HEADER = 'x-guest-id';

export const GUEST_ID_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano
