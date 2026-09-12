'use strict';

/**
 * Gerador ESC/POS para Epson TM-T20X — bobina 80mm.
 *
 * - Font A = 48 colunas (80mm). Layout calculado no código, sem depender
 *   do auto-wrap da impressora.
 * - Destaques usam ESC E 1 (bold) + ESC G 1 (double-strike) juntos para
 *   o preto mais denso possível em térmica.
 * - Acentos: ESC t 16 (Windows-1252) + encoding latin1 (idêntico ao
 *   CP1252 na faixa dos acentos do português).
 * - Se ainda sair claro, ajustar "Print Density" no Epson APD/TM Utility
 *   (isso é firmware, não comando).
 */

const COLS = 48; // Font A em 80mm
const LINE = '-'.repeat(COLS);
const LF = Buffer.from([0x0a]);

const CMD = {
  INIT: Buffer.from([0x1b, 0x40]), // ESC @
  CODEPAGE_1252: Buffer.from([0x1b, 0x74, 16]), // ESC t 16 → WPC1252
  BOLD_ON: Buffer.from([0x1b, 0x45, 1, 0x1b, 0x47, 1]), // ESC E 1 + ESC G 1
  BOLD_OFF: Buffer.from([0x1b, 0x45, 0, 0x1b, 0x47, 0]),
  FONT_A: Buffer.from([0x1b, 0x4d, 0]), // ESC M 0 (48 col)
  FONT_B: Buffer.from([0x1b, 0x4d, 1]), // ESC M 1 (64 col, condensada)
  ALIGN_LEFT: Buffer.from([0x1b, 0x61, 0]),
  ALIGN_CENTER: Buffer.from([0x1b, 0x61, 1]),
  SIZE_NORMAL: Buffer.from([0x1d, 0x21, 0x00]), // GS ! 0
  SIZE_TALL: Buffer.from([0x1d, 0x21, 0x01]), // altura 2x (mantém 48 col)
  SIZE_BIG: Buffer.from([0x1d, 0x21, 0x11]), // 2x largura + altura (24 col)
  CUT: Buffer.from([0x1d, 0x56, 66, 3]), // GS V 66 3 — avança e corta
};

/** Converte para bytes CP1252 (latin1 cobre os acentos pt-BR). */
function encode(text) {
  const clean = String(text)
    .normalize('NFC')
    .replace(/\u00a0/g, ' ') // NBSP do toLocaleString pt-BR
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...');
  const out = Buffer.alloc(clean.length);
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    out[i] = code <= 0xff ? code : 0x3f; // fora do latin1 vira '?'
  }
  return out;
}

/** Quebra por palavra (sem cortar no meio), com recuo nas continuações. */
function wrap(text, width = COLS, indent = '') {
  const contWidth = Math.max(1, width - indent.length);
  const words = [];
  for (const w of String(text).trim().split(/\s+/)) {
    if (!w) continue;
    let rest = w;
    while (rest.length > contWidth) {
      words.push(rest.slice(0, contWidth)); // palavra maior que a linha: corte duro
      rest = rest.slice(contWidth);
    }
    if (rest) words.push(rest);
  }
  const lines = [];
  let line = '';
  let max = width;
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (line.length + 1 + word.length <= max) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
      max = contWidth;
    }
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i ? indent + l : l));
}

/** Coluna esquerda + valor alinhado à direita, exatamente `cols` chars. */
function row(left, right, cols = COLS) {
  const r = String(right ?? '');
  let l = String(left ?? '');
  const maxLeft = cols - r.length - 1;
  if (l.length > maxLeft) {
    l = maxLeft > 3 ? `${l.slice(0, maxLeft - 3)}...` : l.slice(0, Math.max(0, maxLeft));
  }
  return l + ' '.repeat(Math.max(1, cols - l.length - r.length)) + r;
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

class Ticket {
  constructor() {
    this.chunks = [CMD.INIT, CMD.CODEPAGE_1252, CMD.FONT_A, CMD.ALIGN_LEFT];
  }

  push(buf) {
    this.chunks.push(buf);
    return this;
  }

  text(str = '') {
    return this.push(encode(str)).push(LF);
  }

  textWrapped(str, indent = '') {
    for (const line of wrap(str, COLS, indent)) this.text(line);
    return this;
  }

  bold(on) {
    return this.push(on ? CMD.BOLD_ON : CMD.BOLD_OFF);
  }

  size(mode) {
    if (mode === 'big') return this.push(CMD.SIZE_BIG);
    if (mode === 'tall') return this.push(CMD.SIZE_TALL);
    return this.push(CMD.SIZE_NORMAL);
  }

  center() {
    return this.push(CMD.ALIGN_CENTER);
  }

  left() {
    return this.push(CMD.ALIGN_LEFT);
  }

  blank(n = 1) {
    for (let i = 0; i < n; i++) this.push(LF);
    return this;
  }

  cut() {
    return this.push(CMD.CUT);
  }

  build() {
    return Buffer.concat(this.chunks);
  }
}

function formatKitchen(payload) {
  const t = new Ticket();

  // Evitar GS ! 2x (SIZE_BIG) e itens em altura dupla na TM-T20X:
  // em alguns firmwares a combinação com bold+double-strike gera cupom
  // em branco (o cupom do cliente, em tamanho normal, imprime).
  t.center().bold(true).size('tall').text('COZINHA / BAR');
  t.size('normal').text(payload.tab || 'Comanda');
  t.bold(false).left();
  t.text(LINE);

  const items = payload.items || [];
  if (!items.length) {
    t.text('(Sem itens)');
  } else {
    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const name = String(item.name || item.product_name || 'Item').trim() || 'Item';
      t.bold(true).textWrapped(`${qty}x ${name}`, '   ').bold(false);
      if (item.notes) t.textWrapped(`>> ${item.notes}`, '   ');
      t.blank();
    }
  }

  t.text(LINE);
  t.center().text(new Date().toLocaleString('pt-BR')).left();
  t.blank(3).cut();
  return t.build();
}

function formatCustomer(payload) {
  const t = new Ticket();

  t.center().bold(true).size('tall').text(payload.store_name || 'Kabanas');
  t.size('normal').bold(false).left();
  t.text(LINE);

  t.bold(true).text(payload.tab || 'Comanda').bold(false);
  if (payload.customer) t.text(`Cliente: ${payload.customer}`);
  if (payload.waiter) t.text(`Garçom: ${payload.waiter}`);
  if (payload.guest_count) t.text(`Pessoas: ${payload.guest_count}`);
  t.text(LINE);

  for (const item of payload.items || []) {
    t.bold(true).textWrapped(`${item.quantity}x ${item.name}`, '   ').bold(false);
    t.text(row(`   ${money(item.unit_price)} un`, money(item.total)));
    if (item.notes) t.textWrapped(`>> ${item.notes}`, '   ');
  }

  t.text(LINE);
  t.text(row('Subtotal', money(payload.subtotal)));
  if (payload.service_amount) {
    t.text(row(`Serviço (${payload.service_rate || 0}%)`, money(payload.service_amount)));
  }
  if (payload.cover_charge) t.text(row('Couvert', money(payload.cover_charge)));
  if (payload.discount) t.text(row('Desconto', money(payload.discount)));
  t.bold(true).size('tall').text(row('TOTAL', money(payload.total)));
  t.size('normal').bold(false);

  if (payload.payments?.length) {
    t.blank();
    t.text('Pagamentos:');
    for (const payment of payload.payments) {
      t.text(row(`  ${payment.method}`, money(payment.amount)));
      if (payment.change) t.text(row('  Troco', money(payment.change)));
    }
  }

  t.text(LINE);
  t.center().text(new Date().toLocaleString('pt-BR')).left();
  t.blank(3).cut();
  return t.build();
}

/** @returns {Buffer} bytes ESC/POS prontos para envio RAW */
function formatJob(job) {
  if (job.job_type === 'kitchen_ticket') return formatKitchen(job.payload);
  if (job.job_type === 'customer_receipt') return formatCustomer(job.payload);
  const t = new Ticket();
  t.textWrapped(JSON.stringify(job.payload));
  t.blank(3).cut();
  return t.build();
}

/** @returns {Buffer} */
function formatTestPage() {
  const t = new Ticket();
  // Mesmo padrão seguro da via da cozinha: sem SIZE_BIG (2x largura).
  t.center().bold(true).size('tall').text('KABANAS');
  t.size('normal').text('TESTE DE IMPRESSÃO');
  t.bold(false).left();
  t.text(LINE);
  t.text('Normal: A impressora está configurada.');
  t.bold(true).text('Negrito + double-strike (mais escuro).').bold(false);
  t.text('Acentuação: ÁÉÍÓÚ ãõ ç — Ção, Água, Pão');
  t.text(row('Largura 48 colunas', 'OK'));
  t.text('123456789012345678901234567890123456789012345678');
  t.text(LINE);
  t.center().bold(true).text('COZINHA / BAR (amostra)').bold(false);
  t.text('1x Item de teste da cozinha');
  t.text(LINE);
  t.center().text(new Date().toLocaleString('pt-BR')).left();
  t.blank(3).cut();
  return t.build();
}

module.exports = { formatJob, formatTestPage, COLS };
