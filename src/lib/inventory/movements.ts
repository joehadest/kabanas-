export type MovementType = 'entry' | 'exit' | 'adjustment' | 'loss';

export interface InventoryMovement {
  id: string;
  movement_type: MovementType;
  quantity_change: number;
  /** Saldo logo após a movimentação; null nas anteriores a migration_inventory_movement_balance.sql. */
  quantity_after: number | null;
  reason: string;
  created_by: string | null;
  created_at: string;
}

/** "base_quantity da unidade do item rende sales_count vendas do produto" (ex.: 30 L rendem 90 canecas). */
export interface SalesRule {
  base_quantity: number;
  sales_count: number;
}

export interface NamedSalesRule extends SalesRule {
  product_name: string;
}

export interface SoldProduct {
  product: string;
  /** Positivo quando vendeu, negativo quando devolveu (cancelamento). */
  count: number;
}

// Motivos gravados pelos gatilhos de supabase/migration_inventory_sales_usage.sql.
const AUTOMATIC_REASON = /^(?:(?:Venda|Item removido|Item trocado|Quantidade alterada|Cancelado|Comanda cancelada): |Pedido .+: )/;

export function formatQty(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

/** "+3" / "−1,103" com o sinal tipográfico. */
export function formatSigned(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatQty(Math.abs(value))}`;
}

/**
 * Quantas vendas o estoque ainda rende. Cada venda baixa um valor arredondado em
 * 3 casas no banco (50 L / 136 = 0,368), e a folga evita que a sobra do
 * arredondamento mostre uma venda a menos.
 */
export function salesLeft(quantity: number, rule: SalesRule): number {
  return Math.max(0, Math.floor((quantity * rule.sales_count) / rule.base_quantity + 0.25));
}

/** Chope é vendido em canecas; o resto é contado em vendas. */
export function salesNoun(product: string, count: number): string {
  const one = Math.abs(count) === 1;
  return /\bchop/i.test(product) ? (one ? 'caneca' : 'canecas') : one ? 'venda' : 'vendas';
}

export function isAutomatic(movement: InventoryMovement): boolean {
  return movement.created_by === null && AUTOMATIC_REASON.test(movement.reason);
}

/** Produto e quantidade vendidos (ou devolvidos) por uma baixa automática. */
export function parseSale(movement: InventoryMovement, rules: NamedSalesRule[]): SoldProduct | null {
  if (!isAutomatic(movement)) return null;
  const direction = movement.quantity_change < 0 ? 1 : -1;

  const counted = movement.reason.match(/: (\d+)x (.+)$/);
  if (counted) return { product: counted[2], count: direction * Number(counted[1]) };

  // "Quantidade alterada" e "Item trocado" não trazem a quantidade: converte pela regra do produto.
  const product = movement.reason.slice(movement.reason.indexOf(': ') + 2);
  const rule = rules.find((entry) => entry.product_name === product);
  if (!rule) return null;
  const count = Math.round((-movement.quantity_change * rule.sales_count) / rule.base_quantity);
  return count ? { product, count } : null;
}

export interface MovementSummary {
  sold: SoldProduct[];
  entries: number;
  /** Perdas e saídas lançadas à mão (valor positivo). */
  removed: number;
  adjustments: number;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function summarizeMovements(movements: InventoryMovement[], rules: NamedSalesRule[]): MovementSummary {
  const sold = new Map<string, number>();
  let entries = 0;
  let removed = 0;
  let adjustments = 0;

  for (const movement of movements) {
    if (isAutomatic(movement)) {
      const sale = parseSale(movement, rules);
      if (sale) sold.set(sale.product, (sold.get(sale.product) ?? 0) + sale.count);
    } else if (movement.movement_type === 'entry') entries += movement.quantity_change;
    else if (movement.movement_type === 'adjustment') adjustments += movement.quantity_change;
    else removed -= movement.quantity_change;
  }

  return {
    sold: [...sold].map(([product, count]) => ({ product, count })).filter(({ count }) => count !== 0),
    entries: round3(entries),
    removed: round3(removed),
    adjustments: round3(adjustments),
  };
}

export interface MovementDay {
  key: string;
  label: string;
  movements: InventoryMovement[];
}

/** Agrupa por dia (horário do aparelho), mantendo a ordem recebida. */
export function groupByDay(movements: InventoryMovement[]): MovementDay[] {
  const days: MovementDay[] = [];
  for (const movement of movements) {
    const date = new Date(movement.created_at);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const last = days[days.length - 1];
    if (last?.key === key) last.movements.push(movement);
    else {
      const label = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
      days.push({ key, label, movements: [movement] });
    }
  }
  return days;
}
