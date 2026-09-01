const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const execFileAsync = promisify(execFile);

async function listWindowsPrinters() {
  const ps = "Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress";
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], {
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) return parsed.filter(Boolean);
  return parsed ? [parsed] : [];
}

async function printText(printerName, text) {
  if (!printerName) {
    throw new Error('Nenhuma impressora selecionada.');
  }
  const tmp = path.join(os.tmpdir(), `kabanas-${Date.now()}.txt`);
  fs.writeFileSync(tmp, text, 'utf8');
  const ps = `Get-Content -LiteralPath '${tmp.replace(/'/g, "''")}' -Raw | Out-Printer -Name '${printerName.replace(/'/g, "''")}'`;
  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true });
  } finally {
    fs.unlink(tmp, () => {});
  }
}

module.exports = { listWindowsPrinters, printText };
