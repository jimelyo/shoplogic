/**
 * Regenera el resto de iconos de marca a partir de assets/logo.png (1024x1024):
 *   - electron/icons/*         (icns + PNGs para macOS)
 *   - android mipmap (launcher adaptpack: foreground + round)
 *   - android splash.png       (portrait / landscape, todas las densidades)
 *   - social-preview.png       (OG image del repo)
 *
 *   node scripts/make-all-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets', 'logo.png');
const sharpSrc = sharp(SRC);

// —— macOS (reusa icon.icns existente si ya es del nuevo logo; aquí regenera PNGs) ——
const MAC_SIZES = [16, 32, 64, 128, 256, 512];
const macDir = path.join(ROOT, 'electron', 'icons');
fs.mkdirSync(macDir, { recursive: true });
await sharpSrc.clone().resize(1024, 1024).png().toFile(path.join(macDir, 'icon_1024x1024.png'));
for (const s of MAC_SIZES) {
  await sharpSrc.clone().resize(s, s).png().toFile(path.join(macDir, `icon_${s}x${s}.png`));
  await sharpSrc.clone().resize(s * 2, s * 2).png().toFile(path.join(macDir, `icon_${s}x${s}@2x.png`));
}
console.log('✓ electron/icons/* regenerados');

// ._icns: macOS lo genera iconutil si está disponible (solo hosts mac).
try {
  const { execSync } = await import('node:child_process');
  const iconset = path.join(ROOT, '.tmp-icon.iconset');
  fs.mkdirSync(iconset, { recursive: true });
  for (const s of [16, 32, 128, 256, 512]) {
    await sharpSrc.clone().resize(s, s).png().toFile(path.join(iconset, `icon_${s}x${s}.png`));
    if (s <= 512) await sharpSrc.clone().resize(s * 2, s * 2).png().toFile(path.join(iconset, `icon_${s}x${s}@2x.png`));
  }
  execSync(`iconutil -c icns "${iconset}" -o "${path.join(macDir, 'icon.icns')}"`);
  fs.rmSync(iconset, { recursive: true, force: true });
  console.log('✓ electron/icons/icon.icns regenerado (iconutil)');
} catch (e) {
  console.log('ℹ icon.icns existente conservado (iconutil no disponible)');
}

// —— Android launcher (mipmaps). Fondo sólido azul del propio logo + logo centrado ——
// El adaptativo usa ic_launcher_foreground (logo sobre canvas 108dp con margen
// seguro: logo ocupa 66 % del centro) y ic_launcher/round como cuadrado final.
const bg = { r: 10, g: 22, b: 56, alpha: 255 }; // azul oscuro de marca (del logo)
const DENS = [48, 72, 96, 144, 192];
const DENS_NAMES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const dir = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
for (let i = 0; i < DENS.length; i++) {
  const size = DENS[i];
  const fg = Math.round(size * 0.66);
  const fgPng = await sharpSrc.clone().resize(fg, fg).png().toBuffer();
  const fgCanvas = await sharp({ create: { width: size, height: size, channels: 4, background: { r: bg.r, g: bg.g, b: bg.b, alpha: 0 } } })
    .composite([{ input: fgPng, gravity: 'centre' }]).png().toBuffer();
  const full = await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: fgPng, gravity: 'centre' }]).png().toBuffer();
  const d = path.join(dir, `mipmap-${DENS_NAMES[i]}`);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'ic_launcher_foreground.png'), fgCanvas);
  fs.writeFileSync(path.join(d, 'ic_launcher.png'), full);
  fs.writeFileSync(path.join(d, 'ic_launcher_round.png'), full);
}
console.log('✓ android mipmap-* regenerados (mdpi…xxxhdpi)');

// —— Splash: logo centrado sobre fondo azul de marca ——
const SPLASH = [ [480, 320, 'land-mdpi'], [800, 480, 'land-hdpi'], [1280, 720, 'land-xhdpi'], [1600, 960, 'land-xxhdpi'], [1920, 1280, 'land-xxxhdpi'],
                 [480, 800, 'port-mdpi'], [720, 1280, 'port-hdpi'], [960, 1600, 'port-xhdpi'], [1280, 1920, 'port-xxhdpi'], [1600, 2560, 'port-xxxhdpi'] ];
for (const [w, h, name] of SPLASH) {
  const logo = Math.round(Math.min(w, h) * 0.35);
  const logoPng = await sharpSrc.clone().resize(logo, logo).png().toBuffer();
  const png = await sharp({ create: { width: w, height: h, channels: 4, background: bg } })
    .composite([{ input: logoPng, gravity: 'centre' }]).png().toBuffer();
  fs.writeFileSync(path.join(dir, `drawable-${name}`, 'splash.png'), png);
}
console.log('✓ android splash.png regenerados (land+port, 5 densidades)');

// —— social-preview.png (OG del repo, 1280×640 con logo a la izquierda) ——
const logoSocial = await sharpSrc.clone().resize(360, 360).png().toBuffer();
await sharp({ create: { width: 1280, height: 640, channels: 4, background: bg } })
  .composite([{ input: logoSocial, left: 80, top: 140 }])
  .png().toFile(path.join(ROOT, 'social-preview.png'));
console.log('✓ social-preview.png regenerado');

// —— build-icon-source (referencia del instalador) ——
await sharpSrc.clone().resize(512, 512).png().toFile(path.join(ROOT, 'build-icon-source.png'));
console.log('✓ build-icon-source.png regenerado');
