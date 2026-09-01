import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'ui', 'assets', 'logo.svg');
const svg = fs.readFileSync(svgPath);

const targets = [
  { file: 'build/icon.png', size: 256 },
  { file: 'ui/assets/logo.png', size: 128 },
  { file: 'ui/assets/tray.png', size: 32 },
];

fs.mkdirSync(path.join(root, 'build'), { recursive: true });

for (const { file, size } of targets) {
  const out = path.join(root, file);
  await sharp(svg).resize(size, size).png().toFile(out);
  console.log('Gerado:', file);
}

const icoSizes = [256, 128, 64, 48, 32, 16];
const pngBuffers = await Promise.all(
  icoSizes.map((size) => sharp(svg).resize(size, size).png().toBuffer())
);
const ico = await toIco(pngBuffers);
fs.writeFileSync(path.join(root, 'build', 'icon.ico'), ico);
console.log('Gerado: build/icon.ico');

console.log('Ícones prontos para o instalador.');
