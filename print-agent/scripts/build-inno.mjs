import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const unpacked = path.join(root, 'dist', 'win-unpacked');

if (!fs.existsSync(unpacked)) {
  console.error('Execute primeiro: npm run dist:app');
  process.exit(1);
}

const isccCandidates = [
  process.env.ISCC,
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
].filter(Boolean);

const iscc = isccCandidates.find((candidate) => fs.existsSync(candidate));

if (!iscc) {
  console.error('Inno Setup 6 não encontrado.');
  console.error('Instale em https://jrsoftware.org/isdl.php e rode de novo: npm run dist:installer');
  console.error('Alternativa imediata: use dist\\Kabanas Impressao 1.0.0.exe (portátil, sem instalação).');
  process.exit(1);
}

const iss = path.join(root, 'build', 'installer.iss');
console.log('Compilando instalador com Inno Setup...');
execFileSync(iscc, [iss], { stdio: 'inherit', cwd: path.join(root, 'build') });
console.log('Pronto: dist/KabanasImpressao-Setup-1.0.0.exe');
