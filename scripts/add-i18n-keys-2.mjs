/**
 * Segundo lote de claves i18n (guardia del login + backups cifrados).
 * Igual mecánica que add-i18n-keys.mjs: JSON.parse → set → reescribir.
 * Run: node scripts/add-i18n-keys-2.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const setKey = (obj, path, value) => {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === undefined) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
};

const PATCHES = {
  es: [
    ['auth.accountLocked', 'Cuenta bloqueada temporalmente. Inténtalo en {{time}}.'],
    ['auth.accountLockedNow', 'Demasiados intentos fallidos. Cuenta bloqueada {{time}}.'],
    ['settings.encBackupTitle', 'Cifrado del backup (opcional)'],
    ['settings.encBackupPassword', 'Contraseña de cifrado'],
    ['settings.encBackupPlaceholder', 'Déjalo vacío para exportar sin cifrar'],
    ['settings.encBackupHint', 'AES-256-GCM con clave derivada (PBKDF2 310k). Si pierdes la contraseña, el backup no se puede recuperar.'],
    ['settings.exportedEncrypted', 'Backup cifrado exportado'],
    ['settings.encryptedDetected', 'El fichero {{name}} está cifrado. Introduce su contraseña para importarlo.'],
    ['settings.wrongPassword', 'Contraseña incorrecta: el backup no se ha descifrado.'],
    ['settings.unlockAndImport', 'Descifrar e importar'],
  ],
  en: [
    ['auth.accountLocked', 'Account temporarily locked. Try again in {{time}}.'],
    ['auth.accountLockedNow', 'Too many failed attempts. Account locked for {{time}}.'],
    ['settings.encBackupTitle', 'Backup encryption (optional)'],
    ['settings.encBackupPassword', 'Encryption password'],
    ['settings.encBackupPlaceholder', 'Leave empty to export unencrypted'],
    ['settings.encBackupHint', 'AES-256-GCM with derived key (PBKDF2 310k). If you lose the password, the backup cannot be recovered.'],
    ['settings.exportedEncrypted', 'Encrypted backup exported'],
    ['settings.encryptedDetected', 'The file {{name}} is encrypted. Enter its password to import it.'],
    ['settings.wrongPassword', 'Wrong password: the backup could not be decrypted.'],
    ['settings.unlockAndImport', 'Unlock and import'],
  ],
  pt: [
    ['auth.accountLocked', 'Conta temporariamente bloqueada. Tenta de novo em {{time}}.'],
    ['auth.accountLockedNow', 'Demasiadas tentativas falhadas. Conta bloqueada {{time}}.'],
    ['settings.encBackupTitle', 'Encriptação do backup (opcional)'],
    ['settings.encBackupPassword', 'Palavra-passe de encriptação'],
    ['settings.encBackupPlaceholder', 'Deixa vazio para exportar sem encriptar'],
    ['settings.encBackupHint', 'AES-256-GCM com chave derivada (PBKDF2 310k). Se perderes a palavra-passe, o backup não é recuperável.'],
    ['settings.exportedEncrypted', 'Backup encriptado exportado'],
    ['settings.encryptedDetected', 'O ficheiro {{name}} está encriptado. Introduz a sua palavra-passe para importar.'],
    ['settings.wrongPassword', 'Palavra-passe incorreta: o backup não foi desencriptado.'],
    ['settings.unlockAndImport', 'Desencriptar e importar'],
  ],
  zh: [
    ['auth.accountLocked', '账号已临时锁定，请在 {{time}} 后重试。'],
    ['auth.accountLockedNow', '失败次数过多，账号已锁定 {{time}}。'],
    ['settings.encBackupTitle', '备份加密（可选）'],
    ['settings.encBackupPassword', '加密密码'],
    ['settings.encBackupPlaceholder', '留空则导出不加密'],
    ['settings.encBackupHint', 'AES-256-GCM + 派生密钥（PBKDF2 310k 次）。密码丢失后备份无法恢复。'],
    ['settings.exportedEncrypted', '加密备份已导出'],
    ['settings.encryptedDetected', '文件 {{name}} 已加密，请输入其密码以导入。'],
    ['settings.wrongPassword', '密码错误：备份未能解密。'],
    ['settings.unlockAndImport', '解密并导入'],
  ],
  ar: [
    ['auth.accountLocked', 'الحساب مقفل مؤقتاً. حاول بعد {{time}}.'],
    ['auth.accountLockedNow', 'محاولات فاشلة كثيرة. القفل {{time}}.'],
    ['settings.encBackupTitle', 'تشفير النسخة الاحتياطية (اختياري)'],
    ['settings.encBackupPassword', 'كلمة مرور التشفير'],
    ['settings.encBackupPlaceholder', 'اتركها فارغة للتصدير بدون تشفير'],
    ['settings.encBackupHint', 'AES-256-GCM بمفتاح مشتق (PBKDF2 310k). إن فقدت كلمة المرور لن تُستعاد النسخة.'],
    ['settings.exportedEncrypted', 'تم تصدير نسخة مشفرة'],
    ['settings.encryptedDetected', 'الملف {{name}} مشفر. أدخل كلمة مروره للاستيراد.'],
    ['settings.wrongPassword', 'كلمة المرور خاطئة: لم يُفكّ تشفير النسخة.'],
    ['settings.unlockAndImport', 'فك التشفير والاستيراد'],
  ],
};

for (const [loc, list] of Object.entries(PATCHES)) {
  const FILE = `src/i18n/${loc}.ts`;
  const raw = readFileSync(FILE, 'utf8');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const obj = JSON.parse(raw.slice(start, end + 1));
  for (const [key, value] of list) setKey(obj, key, value);
  writeFileSync(FILE, `const ${loc} = ${JSON.stringify(obj, null, 1)};\nexport default ${loc};\n`);
  console.log(`✓ ${FILE}: +${list.length} claves`);
}
