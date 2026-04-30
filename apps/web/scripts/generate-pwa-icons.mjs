import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const iconsDir = join(publicDir, 'icons');
mkdirSync(iconsDir, { recursive: true });

function svg(size, safeArea) {
  const fontSize = Math.round(size * safeArea * 0.55);
  const cx = size / 2;
  const cy = size / 2 + fontSize * 0.35;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#1e293b"/>
    <text x="${cx}" y="${cy}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${fontSize}" text-anchor="middle" fill="#ffffff">A</text>
  </svg>`;
}

async function emit(svgString, outPath) {
  await sharp(Buffer.from(svgString)).png().toFile(outPath);
  console.log('wrote', outPath);
}

await emit(svg(192, 1.0), join(iconsDir, 'icon-192.png'));
await emit(svg(512, 1.0), join(iconsDir, 'icon-512.png'));
await emit(svg(512, 0.8), join(iconsDir, 'icon-maskable-512.png'));
await emit(svg(180, 1.0), join(publicDir, 'apple-touch-icon.png'));
