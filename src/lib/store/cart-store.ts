import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/lib/types/database';

export interface CartItemOption {
  optionId: string;
  name: string;
  price: number;
}

export interface CartItem {
  cartItemId: string; // productId + hash das opções, permite o mesmo produto com combinações diferentes
  productId: string;
  name: string;
  unitPrice: number; // preço base + soma das opções
  imageUrl: string | null;
  quantity: number;
  options: CartItemOption[];
  notes?: string;
}

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  couponDiscount: number;
  addItem: (product: Product, options: CartItemOption[], quantity: number, notes?: string) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  applyCoupon: (code: string, discount: number) => void;
  removeCoupon: () => void;
  clear: () => void;
  subtotal: () => number;
  itemCount: () => number;
}

function buildCartItemId(productId: string, options: CartItemOption[]): string {
  const optionsKey = options
    .map((o) => o.optionId)
    .sort()
    .join(',');
  return `${productId}::${optionsKey}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      couponDiscount: 0,

      addItem: (product, options, quantity, notes) => {
        const cartItemId = buildCartItemId(product.id, options);
        const optionsTotal = options.reduce((sum, o) => sum + o.price, 0);
        const unitPrice = (product.promo_price ?? product.price) + optionsTotal;

        set((state) => {
          const existing = state.items.find((i) => i.cartItemId === cartItemId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + quantity } : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                cartItemId,
                productId: product.id,
                name: product.name,
                unitPrice,
                imageUrl: product.image_url,
                quantity,
                options,
                notes,
              },
            ],
          };
        });
      },

      removeItem: (cartItemId) => set((state) => ({ items: state.items.filter((i) => i.cartItemId !== cartItemId) })),

      updateQuantity: (cartItemId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.cartItemId !== cartItemId)
              : state.items.map((i) => (i.cartItemId === cartItemId ? { ...i, quantity } : i)),
        })),

      applyCoupon: (code, discount) => set({ couponCode: code, couponDiscount: discount }),
      removeCoupon: () => set({ couponCode: null, couponDiscount: 0 }),

      clear: () => set({ items: [], couponCode: null, couponDiscount: 0 }),

      subtotal: () => get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'kabanas-cart',
      // Evita reidratar de localStorage durante o SSR/primeiro paint (o servidor
      // sempre vê o carrinho vazio) — sem isso o cliente e o servidor renderizam
      // conteúdo diferente e o React acusa erro de hidratação. A reidratação real
      // acontece via CartHydration, num useEffect (depois que a hidratação passou).
      skipHydration: true,
    }
  )
);
