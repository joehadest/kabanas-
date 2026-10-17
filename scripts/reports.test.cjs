const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

process.env.TZ = 'America/Sao_Paulo';

function loadTs(file, imports = {}, extra = '', globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { outputText } = ts.transpileModule(source + extra, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const context = {
    exports: {}, Date, Blob, ...globals,
    require(id) { return Object.hasOwn(imports, id) ? imports[id] : require(id); },
  };
  vm.runInNewContext(outputText, context, { filename: file });
  return context.exports;
}

const { fetchAllRows } = loadTs('src/lib/data/fetch-all-rows.ts');

for (const [size, cap] of [[0, 1000], [500, 1000], [1507, 1000], [1123, 73]]) {
  test(`history keeps all ${size} rows with API cap ${cap}`, async () => {
    const data = Array.from({ length: size }, (_, id) => ({ id }));
    const result = await fetchAllRows(async (from, to) => ({
      data: data.slice(from, Math.min(to + 1, from + cap)), error: null, count: size,
    }));
    assert.deepEqual(Array.from(result), data);
  });
}

test('history fails on a later page instead of returning a partial report', async () => {
  await assert.rejects(fetchAllRows(async (from) => from === 0
    ? { data: [{ id: 1 }], error: null, count: 2 }
    : { data: null, error: { message: 'Connection lost' }, count: null }
  ), /Connection lost/);
});

test('history detects missing rows and missing response data', async () => {
  await assert.rejects(fetchAllRows(async () => ({ data: [], error: null, count: 1 })), /incompleto/);
  await assert.rejects(fetchAllRows(async () => ({ data: null, error: null, count: null })), /carregar/);
});

test('report page loads old sales and expenses beyond the first API response', async () => {
  const datasets = {
    sales: Array.from({ length: 1201 }, (_, id) => ({ id })),
    expenses: Array.from({ length: 1103 }, (_, id) => ({ id })),
  };
  const queries = [];
  const client = { from(table) {
    const query = { table, orders: [] };
    queries.push(query);
    const builder = {
      select(columns, options) { query.options = options; return this; },
      eq(column, value) { if (column === 'store_id') query.store = value; return this; },
      order(column) { query.orders.push(column); return this; },
      range(from, to) {
        const data = datasets[table];
        return Promise.resolve({ data: data.slice(from, Math.min(to + 1, from + 127)), error: null, count: data.length });
      },
      single() { return Promise.resolve({ data: { name: 'QA Store', default_tax_rate: 6 } }); },
      then(resolve, reject) { return Promise.resolve({ data: [] }).then(resolve, reject); },
    };
    return builder;
  } };
  const { default: page } = loadTs('src/app/admin/relatorios/page.tsx', {
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/data/get-store': { getActiveStore: async () => ({ id: 'store-qa', name: 'QA' }) },
    '@/lib/data/fetch-all-rows': { fetchAllRows },
    '@/components/admin/ReportsAndSimulator': { ReportsAndSimulator: 'ReportsAndSimulator' },
  });
  const result = await page();
  assert.equal(result.props.sales.length, 1201);
  assert.equal(result.props.expenses.length, 1103);
  assert.equal(result.props.sales.at(-1).id, 1200);
  for (const query of queries.filter(q => q.table in datasets)) {
    assert.equal(query.store, 'store-qa');
    assert.equal(query.options.count, 'exact');
    assert.equal(query.orders.at(-1), 'id');
  }
});

function reportHarness() {
  const states = [];
  let cursor = 0, tree, csvBlob, download, printCalls = 0, downloadCalls = 0;
  const namedComponents = new Proxy({}, { get: (_, key) => key });
  const imports = {
    react: {
      useMemo: f => f(),
      useState(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], value => { states[index] = value; }];
      },
    },
    '@/components/ui/floating-toast': {
      FloatingToast: 'FloatingToast',
      useFloatingToast: () => ({ toast: null, showToast() {}, clearToast() {} }),
    },
    '@/components/ui/collapsible-list': {
      ShowMoreToggle: 'ShowMoreToggle',
      useLimitedList: (items, limit) => ({ visible: items.slice(0, limit), hiddenCount: Math.max(0, items.length - limit), showAll: false, toggle() {} }),
    },
    '@/lib/utils/format': { formatCurrency: value => String(value), parseDecimal: Number },
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    '@/lib/brand': { BRAND: { name: 'QA' } },
  };
  for (const id of ['recharts', 'lucide-react', '@/components/ui/button', '@/components/ui/input', '@/components/ui/page-layout', '@/components/admin/ReportPrintDocument']) imports[id] = namedComponents;
  const component = loadTs('src/components/admin/ReportsAndSimulator.tsx', imports,
    '\nexport { isDateInSelectedDay };', {
      URL: { createObjectURL(blob) { csvBlob = blob; return 'blob:qa'; }, revokeObjectURL() {} },
      document: { createElement() { return { set href(value) {}, set download(value) { download = value; }, click() { downloadCalls++; } }; } },
      window: { print() { printCalls++; } },
    });
  function nodes(node = tree, result = []) {
    if (Array.isArray(node)) node.forEach(child => nodes(child, result));
    else if (node && typeof node === 'object' && node.props) {
      result.push(node);
      Object.values(node.props).filter(v => v && typeof v === 'object').forEach(v => nodes(v, result));
    }
    return result;
  }
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join('');
    return node?.props ? text(node.props.children) : typeof node === 'string' ? node : '';
  }
  const find = type => nodes().find(n => n.type === type);
  const button = label => nodes().find(n => ['button', 'Button'].includes(n.type) && text(n) === label);
  let props = { sales: [], expenses: [], payments: [] };
  function render(nextProps = props) { props = nextProps; cursor = 0; tree = component.ReportsAndSimulator(props); }
  function date(value) { find('Input').props.onChange({ target: { value } }); render(); }
  function period(label) { button(label).props.onClick(); render(); }
  render();
  return { render, find, button, date, period, component,
    output: () => ({ csvBlob, download, printCalls, downloadCalls }),
  };
}

test('daily boundaries include local midnight and exclude the next day', () => {
  const { isDateInSelectedDay: includes } = reportHarness().component;
  for (const [timestamp, expected] of [
    ['2026-10-17T02:59:59.999Z', false], ['2026-10-17T03:00:00Z', true],
    ['2026-10-18T02:59:59.999Z', true], ['2026-10-18T03:00:00Z', false],
  ]) assert.equal(includes(new Date(timestamp), '2026-10-17'), expected);
  assert.equal(includes(new Date('2024-02-29T12:00:00-03:00'), '2024-02-29'), true);
});

test('empty and invalid dates show validation and cannot export even through handlers', () => {
  const h = reportHarness();
  h.period('Dia');
  for (const value of ['', '2026-02-30', 'invalid']) {
    h.date(value);
    assert.equal(h.find('Input').props['aria-invalid'], true);
    assert.equal(h.find('Input').props['aria-describedby'], 'report-day-error');
    assert.match(h.find('EmptyState').props.message, /Selecione uma data/);
    for (const label of ['Exportar CSV', 'Exportar PDF']) {
      assert.equal(h.button(label).props.disabled, true);
      h.button(label).props.onClick();
    }
  }
  assert.equal(h.output().downloadCalls, 0);
  assert.equal(h.output().printCalls, 0);
  h.date('2026-10-17');
  assert.equal(h.find('Input').props['aria-invalid'], false);
  assert.equal(h.button('Exportar CSV').props.disabled, false);
  assert.equal(h.button('Exportar PDF').props.disabled, true);
});

test('daily DRE, chart, CSV and print agree; pending expenses stay outside paid totals', async () => {
  const h = reportHarness();
  const sale = (occurred_at, amount) => ({ occurred_at, total_amount: amount, total_cost: 60, payment_fee: 0, tax_amount: 0, net_profit: amount - 60 });
  const expense = (description, due_date, paid_at, amount) => ({ description, due_date, paid_at, amount, expense_categories: { name: 'QA' } });
  h.render({ payments: [], sales: [sale('2026-10-17T03:00:00Z', 100), sale('2026-10-18T02:59:59Z', 200), sale('2026-10-18T03:00:00Z', 999)], expenses: [
    expense('paid today', '2026-10-01', '2026-10-17T15:00:00Z', 20),
    expense('pending today', '2026-10-17', null, 50),
    expense('paid yesterday', '2026-10-17', '2026-10-16T15:00:00Z', 90),
  ] });
  h.period('Dia'); h.date('2026-10-17');
  const print = h.find('ReportPrintDocument').props;
  assert.equal(print.metrics.revenue, 300);
  assert.equal(print.metrics.salesCount, 2);
  assert.equal(print.metrics.operationalExpenses, 20);
  assert.equal(print.metrics.netProfit, 160);
  assert.equal(print.sales.length, 2);
  assert.equal(print.expenses.length, 2);
  assert.equal(print.paidExpensesCount, 1);
  assert.equal(print.expensesByCategory[0].value, 20);
  assert.equal(h.find('BarChart').props.data[0].faturamento, 300);
  h.button('Exportar CSV').props.onClick();
  const csv = await h.output().csvBlob.text();
  assert.equal(h.output().download, 'relatorio-kabanas-2026-10-17.csv');
  assert.match(csv, /Dia 17\/10\/2026/);
  assert.match(csv, /Receita bruta,300/);
  assert.match(csv, /paid today/);
  assert.doesNotMatch(csv, /pending today|paid yesterday|999/);
  h.button('Exportar PDF').props.onClick();
  assert.equal(h.output().printCalls, 1);
  h.date('2026-10-18');
  assert.equal(h.find('ReportPrintDocument').props.metrics.revenue, 999);
});

test('invalid daily date does not block other periods and selected date is retained', () => {
  const h = reportHarness();
  h.period('Dia'); h.date('');
  for (const label of ['7 dias', '30 dias', 'Este m\u00eas', 'Este ano', 'Tudo']) {
    h.period(label);
    assert.equal(h.button('Exportar CSV').props.disabled, false);
  }
  h.period('Dia'); h.date('2024-02-29'); h.period('7 dias'); h.period('Dia');
  assert.equal(h.find('Input').props.value, '2024-02-29');
});
