#!/usr/bin/env node
/**
 * Genera electron/icon.ico a partir de public/icon.svg.
 *
 * Rasteriza el SVG a 6 tamaños con sharp y empaqueta los PNG dentro de un
 * contenedor ICO (formato PNG-in-ICO, válido desde Windows Vista). El resultado
 * lo usan la ventana de Electron y electron-builder (instalador + .exe).
 *
 *   node scripts/make-icon.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [256, 128, 64, 48, 32, 16];
const OUT = path.join(ROOT, 'electron', 'icon.ico');

const svg = fs.readFileSync(path.join(ROOT, 'public', 'icon.svg'));

// Rasteriza cada tamaño.
const pngs = [];
for (const size of SIZES) {
  const png = await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
  pngs.push({ size, png });
}

// Contenedor ICO: cabecera (6B) + directorio (16B por imagen) + datos PNG.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 0 + 2); // type: icon
header.writeUInt16LE(pngs.length, 0 + 4);

const dir = Buffer.alloc(16 * pngs.length);
let offset = 6 + dir.length;
pngs.forEach(({ size, png }, i) => {
  const e = i * 16;
  dir.writeUInt8(size === 256 ? 0 : size, e); // width (0 = 256)
  dir.writeUInt8(size === 256 ? 0 : size, e + 1); // height
  dir.writeUInt8(0, e + 2); // palette
  dir.writeUInt8(0, e + 3); // reserved
  dir.writeUInt16LE(1, e + 4); // planes
  dir.writeUInt16LE(32, e + 6); // bpp
  dir.writeUInt32LE(png.length, e + 8);
  dir.writeUInt32LE(offset, e + 12);
  offset += png.length;
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([header, dir, ...pngs.map((p) => p.png)]));

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`✓ electron/icon.ico generado (${pngs.length} tamaños: ${SIZES.join(', ')} px · ${kb} kB)`);
