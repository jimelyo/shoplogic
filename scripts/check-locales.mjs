#!/usr/bin/env node
/**
 * Comprueba que los cinco idiomas del proyecto tengan exactamente las mismas
 * claves y los mismos marcadores {{...}}, usando `es` como referencia.
 *
 *   npm run check:i18n
 *
 * Sale con código 1 si hay cualquier desfase, para poder engancharlo al build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['es', 'en', 'pt', 'zh', 'ar'];
const REFERENCE = 'es';

/** Reads `src/i18n/<lang>.ts` and returns the exported object as plain JSON. */
function load(lang) {
  const file = path.join(ROOT, 'src', 'i18n', `${lang}.ts`);
  const src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf('{', src.indexOf('='));
  const end = src.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(`${lang}.ts: no se encontró el objeto de traducciones`);
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch (e) {
    throw new Error(`${lang}.ts: el objeto no es JSON válido (${e.message})`);
  }
}

/** Flattens `{ a: { b: 'x' } }` into `Map('a.b' -> 'x')`. */
function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.set(key, Array.isArray(v) ? JSON.stringify(v) : String(v));
  }
  return out;
}

const placeholders = (s) => (String(s).match(/\{\{\w+\}\}/g) ?? []).sort().join(',');

const reference = flatten(load(REFERENCE));
let failed = 0;

console.log(`Referencia: ${REFERENCE}.ts → ${reference.size} claves\n`);

for (const lang of LANGS) {
  const current = flatten(load(lang));
  const missing = [...reference.keys()].filter((k) => !current.has(k));
  const extra = [...current.keys()].filter((k) => !reference.has(k));
  const badPlaceholders = [...reference.keys()]
    .filter((k) => current.has(k) && placeholders(reference.get(k)) !== placeholders(current.get(k)));
  const empty = [...current.entries()].filter(([, v]) => !v.trim()).map(([k]) => k);

  const problems = missing.length + extra.length + badPlaceholders.length + empty.length;
  if (!problems) {
    console.log(`✓ ${lang.padEnd(2)} ${current.size} claves · idéntico`);
    continue;
  }
  failed += 1;
  console.error(`✗ ${lang.padEnd(2)} ${current.size} claves · ${problems} problemas`);
  const show = (label, list) => list.length && console.error(`    ${label}: ${list.slice(0, 8).join(', ')}${list.length > 8 ? ` (+${list.length - 8})` : ''}`);
  show('faltan', missing);
  show('sobran', extra);
  show('placeholders', badPlaceholders);
  show('vacías', empty);
}

if (failed) {
  console.error(`\n${failed} idioma(s) desincronizado(s).`);
  process.exit(1);
}
console.log(`\nOK: ${LANGS.length} idiomas con ${reference.size} claves idénticas.`);
