const LINE = '--------------------------------';

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatKitchen(payload) {
  const lines = ['COZINHA / BAR', LINE, payload.tab || 'Comanda', ''];
  for (const item of payload.items || []) {
    lines.push(`${item.quantity}x ${item.name}`);
    if (item.notes) lines.push(`  >> ${item.notes}`);
    lines.push('');
  }
  lines.push(LINE);
  lines.push(new Date().toLocaleString('pt-BR'));
  lines.push('\n\n\n');
  return lines.join('\r\n');
}

function formatCustomer(payload) {
  const lines = [payload.store_name || 'Kabanas', LINE, payload.tab || 'Comanda'];
  if (payload.customer) lines.push(`Cliente: ${payload.customer}`);
  if (payload.waiter) lines.push(`Garçom: ${payload.waiter}`);
  if (payload.guest_count) lines.push(`Pessoas: ${payload.guest_count}`);
  lines.push('');

  for (const item of payload.items || []) {
    lines.push(`${item.quantity}x ${item.name}`);
    lines.push(`   ${money(item.unit_price)}  ${money(item.total)}`);
    if (item.notes) lines.push(`   >> ${item.notes}`);
  }

  lines.push(LINE);
  lines.push(`Subtotal${' '.repeat(18)}${money(payload.subtotal)}`);
  if (payload.service_amount) {
    lines.push(`Serviço (${payload.service_rate || 0}%)${' '.repeat(8)}${money(payload.service_amount)}`);
  }
  if (payload.cover_charge) lines.push(`Couvert${' '.repeat(19)}${money(payload.cover_charge)}`);
  if (payload.discount) lines.push(`Desconto${' '.repeat(17)}${money(payload.discount)}`);
  lines.push(`TOTAL${' '.repeat(21)}${money(payload.total)}`);

  if (payload.payments?.length) {
    lines.push('');
    lines.push('Pagamentos:');
    for (const payment of payload.payments) {
      lines.push(`  ${payment.method}: ${money(payment.amount)}`);
      if (payment.change) lines.push(`  Troco: ${money(payment.change)}`);
    }
  }

  lines.push(LINE);
  lines.push(new Date().toLocaleString('pt-BR'));
  lines.push('\n\n\n');
  return lines.join('\r\n');
}

function formatJob(job) {
  if (job.job_type === 'kitchen_ticket') return formatKitchen(job.payload);
  if (job.job_type === 'customer_receipt') return formatCustomer(job.payload);
  return JSON.stringify(job.payload, null, 2);
}

function formatTestPage() {
  return [
    'KABANAS — TESTE DE IMPRESSÃO',
    LINE,
    'Se você está lendo isto, a impressora',
    'está configurada corretamente.',
    '',
    new Date().toLocaleString('pt-BR'),
    '\n\n\n',
  ].join('\r\n');
}

module.exports = { formatJob, formatTestPage };
