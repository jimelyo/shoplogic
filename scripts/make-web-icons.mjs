#!/usr/bin/env node
/**
 * Genera los iconos web a partir de assets/logo.png (fuente 1024x1024):
 *   public/icon-512.png  -> favicon + manifest PWA + README
 * public/icon.svg se ELIMINA porque el logo actual es una ilustración raster;
 * el manifest pasa a referenciar solo PNG.
 *
 *   node scripts/make-web-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets', 'logo.png');

if (!fs.existsSync(SRC)) {
  console.error(`✗ Falta ${path.relative(ROOT, SRC)} (logo fuente 1024x1024).`);
  process.exit(1);
}

await sharp(SRC).resize(512, 512).png({ compressionLevel: 9 }).toFile(path.join(ROOT, 'public', 'icon-512.png'));

// Limpia el icono vectorial antiguo y sus referencias rotas.
for (const f of ['icon.svg', 'icons.svg', 'favicon.svg']) {
  const p = path.join(ROOT, 'public', f);
  if (fs.existsSync(p)) { fs.rmSync(p); console.log(`✓ eliminado public/${f} (icono antiguo)`); }
}

console.log('✓ public/icon-512.png generado (512x512 px, transparencia)');
