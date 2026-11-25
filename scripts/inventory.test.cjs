const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

process.env.TZ = 'America/Sao_Paulo';

const source = fs.readFileSync(path.join(__dirname, '..', 'src/lib/inventory/movements.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const lib = {};
new Function('exports', outputText)(lib);

const OKTOS = { product_name: 'CHOPP OKTOS ARTESANAL', base_quantity: 50, sales_count: 136 };
const move = (reason, quantity_change, extra = {}) => ({
  id: reason,
  movement_type: quantity_change < 0 ? 'exit' : 'adjustment',
  quantity_change,
  quantity_after: null,
  reason,
  created_by: null,
  created_at: '2026-11-25T22:00:00Z',
  ...extra,
});
const manual = (type, quantity_change, reason = 'motivo') => move(reason, quantity_change, { movement_type: type, created_by: 'user' });

test('every mug sold lowers the remaining count by exactly one, despite database rounding', () => {
  // O banco baixa round(50/136, 3) = 0,368 L por caneca, um pouco mais que 0,367647.
  let quantity = 50;
  for (let sold = 0; sold <= 135; sold += 1) {
    assert.equal(lib.salesLeft(quantity, OKTOS), 136 - sold, `after ${sold} sold`);
    quantity = Math.max(0, Math.round((quantity - 0.368) * 1000) / 1000);
  }
  assert.equal(lib.salesLeft(0, OKTOS), 0);
});

test('a leftover smaller than one sale is not offered', () => {
  assert.equal(lib.salesLeft(0.18, OKTOS), 0);
  assert.equal(lib.salesLeft(26.25, { base_quantity: 35, sales_count: 20 }), 15);
});

test('sales and returns are read from the reasons the database writes', () => {
  const parse = (reason, change) => lib.parseSale(move(reason, change), [OKTOS]);
  assert.deepEqual(parse('Venda: 3x CHOPP OKTOS ARTESANAL', -1.103), { product: 'CHOPP OKTOS ARTESANAL', count: 3 });
  assert.deepEqual(parse('Cancelado: 2x CHOPP OKTOS ARTESANAL', 0.735), { product: 'CHOPP OKTOS ARTESANAL', count: -2 });
  assert.deepEqual(parse('Comanda cancelada: 1x CHOPP OKTOS ARTESANAL', 0.368), { product: 'CHOPP OKTOS ARTESANAL', count: -1 });
  assert.deepEqual(parse('Pedido A-12: 4x CHOPP OKTOS ARTESANAL', -1.471), { product: 'CHOPP OKTOS ARTESANAL', count: 4 });
  assert.deepEqual(parse('Pedido A-12 cancelado: 4x CHOPP OKTOS ARTESANAL', 1.471), { product: 'CHOPP OKTOS ARTESANAL', count: -4 });
  assert.deepEqual(parse('Venda: 1x COMBO 2x1 CHOPP', -0.735), { product: 'COMBO 2x1 CHOPP', count: 1 });
});

test('a quantity change has no count in the reason, so it is converted by the rule', () => {
  assert.deepEqual(lib.parseSale(move('Quantidade alterada: CHOPP OKTOS ARTESANAL', -1.103), [OKTOS]), { product: 'CHOPP OKTOS ARTESANAL', count: 3 });
  assert.deepEqual(lib.parseSale(move('Quantidade alterada: CHOPP OKTOS ARTESANAL', 0.368), [OKTOS]), { product: 'CHOPP OKTOS ARTESANAL', count: -1 });
  assert.equal(lib.parseSale(move('Quantidade alterada: PRODUTO SEM REGRA', -1), [OKTOS]), null);
});

test('a movement typed by a person is never counted as a sale', () => {
  const typed = manual('exit', -2, 'Venda: 5x CHOPP OKTOS ARTESANAL');
  assert.equal(lib.isAutomatic(typed), false);
  assert.equal(lib.parseSale(typed, [OKTOS]), null);
  assert.equal(lib.isAutomatic(move('Compra do fornecedor', 10)), false);
});

test('the summary separates net sales, entries, losses and adjustments', () => {
  const summary = lib.summarizeMovements(
    [
      move('Venda: 10x CHOPP OKTOS ARTESANAL', -3.676),
      move('Cancelado: 2x CHOPP OKTOS ARTESANAL', 0.735),
      move('Venda: 1x TULIPA', -0.5),
      move('Cancelado: 1x TULIPA', 0.5),
      manual('entry', 50),
      manual('loss', -0.4),
      manual('exit', -0.2),
      manual('adjustment', -1.5),
    ],
    [OKTOS]
  );
  assert.deepEqual(summary, {
    sold: [{ product: 'CHOPP OKTOS ARTESANAL', count: 8 }],
    entries: 50,
    removed: 0.6,
    adjustments: -1.5,
  });
});

test('days follow the local clock and keep the newest first', () => {
  const at = (created_at) => move('Venda: 1x X', -1, { created_at });
  const days = lib.groupByDay([at('2026-11-26T03:30:00Z'), at('2026-11-26T02:30:00Z'), at('2026-11-25T20:00:00Z')]);
  assert.deepEqual(days.map((day) => [day.key, day.movements.length]), [['2026-11-26', 1], ['2026-11-25', 2]]);
  assert.match(days[0].label, /quinta-feira, 26\/11/);
});

test('chopp is counted in mugs and everything else in sales', () => {
  assert.equal(lib.salesNoun('CHOPP OKTOS ARTESANAL', 1), 'caneca');
  assert.equal(lib.salesNoun('Chope Pilsen', -3), 'canecas');
  assert.equal(lib.salesNoun('ESPETINHO FRANGO', 2), 'vendas');
  assert.equal(lib.formatSigned(-1.103), '−1,103');
  assert.equal(lib.formatSigned(3), '+3');
  assert.equal(lib.formatSigned(0), '0');
});
