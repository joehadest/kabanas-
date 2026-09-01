// Tipos manuais que espelham supabase/schema.sql.
// Em produção, prefira gerar via: `supabase gen types typescript --linked`
// e substituir este arquivo (mantendo os aliases exportados abaixo).

export type UserRole = 'customer' | 'restaurant' | 'admin';
export type OrderStatus = 'received' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type PaymentMethod = 'pix' | 'card_on_delivery' | 'cash';
export type DeliveryFeeType = 'fixed' | 'per_km';
export type DiscountType = 'percentage' | 'fixed';

export interface StoreSettings {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  banner_url: string | null;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  opening_hours: Record<string, { open: string; close: string; closed: boolean }>;
  delivery_fee_type: DeliveryFeeType;
  delivery_fee_fixed: number;
  delivery_fee_per_km: number;
  min_order_value: number;
  is_open_override: boolean | null;
}

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export interface Address {
  id: string;
  user_id: string | null;
  guest_id: string | null;
  label: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
}

export interface Category {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ProductOption {
  id: string;
  group_id: string;
  name: string;
  price: number;
  is_active: boolean;
}

export interface ProductOptionGroup {
  id: string;
  product_id: string;
  name: string;
  is_required: boolean;
  min_select: number;
  max_select: number;
  options: ProductOption[];
}

export interface Product {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  image_url: string | null;
  cost_price?: number;
  packaging_cost?: number;
  other_variable_cost?: number;
  tax_rate?: number;
  sort_order?: number;
  is_active: boolean;
  is_available: boolean;
  option_groups?: ProductOptionGroup[];
}

export interface Order {
  id: string;
  store_id: string;
  user_id: string | null;
  guest_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  address_id: string | null;
  status: OrderStatus;
  payment_method: PaymentMethod;
  change_for: number | null;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  order_code: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  address?: Address | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  options?: { option_name: string; option_price: number }[];
}

export const ORDER_STATUS_FLOW: OrderStatus[] = ['received', 'preparing', 'out_for_delivery', 'delivered'];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Recebido',
  preparing: 'Em Preparo',
  out_for_delivery: 'Saiu para Entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

// Placeholder para uso com createClient<Database>() — substitua pelo tipo
// gerado automaticamente quando o projeto Supabase estiver linkado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
