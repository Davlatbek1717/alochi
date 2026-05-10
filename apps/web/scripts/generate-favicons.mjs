/**
 * One-off helper: regenerate PNG favicons + apple-touch-icon from logo-mark.svg.
 *
 * Run after editing the logo SVGs:
 *   pnpm --filter web node scripts/generate-favicons.mjs
 *
 * Generates:
 *   public/apple-touch-icon.png            (180×180, no padding)
 *   public/icons/icon-192.png              (192×192, no padding)
 *   public/icons/icon-512.png              (512×512, no padding)
 *   public/icons/icon-maskable-512.png     (512×512 with ~10% safe-zone padding,
 *                                           cream-tinted background so the icon
 *                                           doesn't disappear on light home screens)
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'public');
const SVG = readFileSync(resolve(PUBLIC, 'logo-mark.svg'));

mkdirSync(resolve(PUBLIC, 'icons'), { recursive: true });

// Plain icons — fully transparent background, no padding.
async function plainIcon(size, outPath) {
  await sharp(SVG, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  console.log(`  ✓ ${outPath} (${size}×${size})`);
}

// Maskable icon — Android crops to a circle/rounded rect, so the artwork must
// sit inside a 80%-of-canvas safe zone. We render the logo at 80% size,
// centered on a cream background that matches the manifest theme color.
async function maskableIcon(size, outPath) {
  const inner = Math.round(size * 0.78);
  const offset = Math.round((size - inner) / 2);
  const innerPng = await sharp(SVG, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 250, b: 240, alpha: 1 }, // cream — matches manifest
    },
  })
    .composite([{ input: innerPng, top: offset, left: offset }])
    .png()
    .toFile(outPath);
  console.log(`  ✓ ${outPath} (${size}×${size}, maskable)`);
}

console.log('Generating favicons from logo-mark.svg…');
await plainIcon(180, resolve(PUBLIC, 'apple-touch-icon.png'));
await plainIcon(192, resolve(PUBLIC, 'icons', 'icon-192.png'));
await plainIcon(512, resolve(PUBLIC, 'icons', 'icon-512.png'));
await maskableIcon(512, resolve(PUBLIC, 'icons', 'icon-maskable-512.png'));
console.log('Done.');
