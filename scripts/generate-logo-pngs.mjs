import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const svgPath = 'public/brand/logo-badge.svg';
const svg = readFileSync(svgPath);
writeFileSync(svgPath, svg.toString('utf8'), 'utf8');

for (const size of [512, 192, 180, 32, 16]) {
  const out = `public/brand/logo-badge-${size}.png`;
  execSync(`npx --yes @resvg/resvg-js-cli --fit-width ${size} ${svgPath} ${out}`, {
    stdio: 'inherit',
  });
}
