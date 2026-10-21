/**
 * node-forge advisory guard (GHSA-86w9-cpqp-85rv).
 *
 * The high-severity advisory is in RSA PKCS#1 v1.5 *signature verification*
 * (extra nested DigestAlgorithm accepted). ShopLogic uses node-forge only to
 * unwrap PKCS#12 containers and export PEM material; it never verifies a
 * signature with forge. This guard fails CI if that invariant changes, because
 * a future `verify()` call would make the advisory reachable.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  /forge\.pki\.verify\s*\(/,
  /forge\.pki\.rsa\.verify\s*\(/,
  /forge\.pki\.rsa\.publicKey\.prototype\.verify\s*\(/,
  /\.publicKey\.verify\s*\(/,
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = [...walk('electron'), ...walk('src')].filter((f) => /\.(cjs|mjs|js|ts)$/.test(f));
const hits = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const re of FORBIDDEN) if (re.test(text)) hits.push(`${file}: ${re}`);
}
if (hits.length) {
  console.error('node-forge signature verification is reachable; GHSA-86w9-cpqp-85rv applies:');
  for (const hit of hits) console.error('  ' + hit);
  console.error('Use WebCrypto/Node crypto for verification, or patch/migrate node-forge first.');
  process.exit(1);
}
const version = JSON.parse(readFileSync('node_modules/node-forge/package.json', 'utf8')).version;
console.log(`node-forge ${version}: PKCS#12 parsing/signing only; no signature-verification API is used.`);
