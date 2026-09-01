let config = null;
let wizardStep = 0;
let printers = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(message, type = '') {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast ${type}`.trim();
  el.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add('hidden'), 3200);
}

function showView(id) {
  ['wizard', 'dashboard', 'settings'].forEach((view) => {
    $(`#${view}`).classList.toggle('hidden', view !== id);
  });
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fillPrinterSelect(select, value) {
  select.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = printers.length ? 'Selecione...' : 'Nenhuma impressora encontrada';
  select.appendChild(empty);
  for (const name of printers) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === value) opt.selected = true;
    select.appendChild(opt);
  }
}

async function loadPrinters() {
  const result = await window.kabanas.listPrinters();
  printers = result.printers || [];
  if (result.error) showToast('Não foi possível listar impressoras.', 'error');
  fillPrinterSelect($('#input-kitchen-printer'), config?.kitchenPrinter);
  fillPrinterSelect($('#input-customer-printer'), config?.customerPrinter);
  fillPrinterSelect($('#settings-kitchen-printer'), config?.kitchenPrinter);
  fillPrinterSelect($('#settings-customer-printer'), config?.customerPrinter);
}

function setWizardStep(step) {
  wizardStep = step;
  $$('.wizard-step').forEach((el) => {
    el.classList.toggle('hidden', Number(el.dataset.step) !== step);
  });
  $$('.step-dot').forEach((dot) => {
    dot.classList.toggle('active', Number(dot.dataset.step) === step);
  });
}

function updateStatus(status) {
  const card = $('#status-card');
  const title = $('#status-title');
  const sub = $('#status-sub');

  card.classList.remove('online', 'offline', 'error');
  if (status.lastError) {
    card.classList.add('error');
    title.textContent = 'Problema de conexão';
    sub.textContent = status.lastError;
  } else if (status.online) {
    card.classList.add('online');
    title.textContent = 'Conectado e aguardando pedidos';
    sub.textContent = `Serviço local na porta ${status.port}`;
  } else if (status.running) {
    card.classList.add('offline');
    title.textContent = 'Aguardando internet';
    sub.textContent = 'O programa tentará novamente em instantes';
  } else {
    card.classList.add('offline');
    title.textContent = 'Não configurado';
    sub.textContent = 'Conclua a instalação para ativar';
  }

  $('#stat-printed').textContent = String(status.printedToday ?? 0);
  $('#stat-poll').textContent = formatTime(status.lastPollAt);
}

function fillDashboard() {
  $('#info-kitchen').textContent = config?.kitchenPrinter || '—';
  $('#info-customer').textContent = config?.customerPrinter || '—';
}

function fillSettingsForm() {
  $('#settings-store-id').value = config?.storeId || '';
  $('#settings-token').value = '';
  $('#settings-start-windows').checked = config?.startWithWindows !== false;
  fillPrinterSelect($('#settings-kitchen-printer'), config?.kitchenPrinter);
  fillPrinterSelect($('#settings-customer-printer'), config?.customerPrinter);
}

async function init() {
  config = await window.kabanas.getConfig();
  await loadPrinters();

  if (config.setupComplete) {
    showView('dashboard');
    fillDashboard();
    const status = await window.kabanas.getStatus();
    updateStatus(status);
  } else {
    showView('wizard');
    setWizardStep(0);
    $('#input-start-windows').checked = true;
  }

  window.kabanas.onStatus(updateStatus);
}

document.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;

  switch (action) {
    case 'wizard-next':
      if (wizardStep === 1) {
        const storeId = $('#input-store-id').value.trim();
        const token = $('#input-token').value.trim();
        if (!storeId || !token) {
          showToast('Preencha o Store ID e o token.', 'error');
          return;
        }
        config = { ...config, storeId, agentSecret: token };
      }
      setWizardStep(Math.min(3, wizardStep + 1));
      if (wizardStep === 2) void loadPrinters();
      break;

    case 'wizard-prev':
      setWizardStep(Math.max(0, wizardStep - 1));
      break;

    case 'wizard-finish': {
      const kitchen = $('#input-kitchen-printer').value;
      const customer = $('#input-customer-printer').value;
      if (!kitchen || !customer) {
        showToast('Selecione as duas impressoras.', 'error');
        return;
      }
      try {
        await window.kabanas.saveConfig({
          storeId: $('#input-store-id').value.trim(),
          agentSecret: $('#input-token').value.trim(),
          kitchenPrinter: kitchen,
          customerPrinter: customer,
          startWithWindows: $('#input-start-windows').checked,
        });
        config = await window.kabanas.getConfig();
        setWizardStep(3);
        showToast('Instalação concluída!', 'success');
      } catch {
        showToast('Não foi possível salvar. Verifique os dados.', 'error');
      }
      break;
    }

    case 'go-dashboard':
      showView('dashboard');
      fillDashboard();
      break;

    case 'open-admin':
      await window.kabanas.openAdmin();
      break;

    case 'open-settings':
      fillSettingsForm();
      showView('settings');
      break;

    case 'back-dashboard':
      showView('dashboard');
      fillDashboard();
      break;

    case 'save-settings':
      try {
        const partial = {
          storeId: $('#settings-store-id').value.trim(),
          kitchenPrinter: $('#settings-kitchen-printer').value,
          customerPrinter: $('#settings-customer-printer').value,
          startWithWindows: $('#settings-start-windows').checked,
        };
        const token = $('#settings-token').value.trim();
        if (token) partial.agentSecret = token;
        await window.kabanas.saveConfig(partial);
        config = await window.kabanas.getConfig();
        showView('dashboard');
        fillDashboard();
        showToast('Configurações salvas.', 'success');
      } catch {
        showToast('Erro ao salvar configurações.', 'error');
      }
      break;

    case 'test-kitchen':
      try {
        await window.kabanas.testPrint(config?.kitchenPrinter);
        showToast('Teste enviado para a cozinha.', 'success');
      } catch (e) {
        showToast(e.message || 'Falha no teste.', 'error');
      }
      break;

    case 'test-customer':
      try {
        await window.kabanas.testPrint(config?.customerPrinter);
        showToast('Teste enviado para o caixa.', 'success');
      } catch (e) {
        showToast(e.message || 'Falha no teste.', 'error');
      }
      break;

    default:
      break;
  }
});

init();
