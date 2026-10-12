// Adds the new i18n keys (commandPalette + settings verifactu/extBackup) to the
// en/pt/zh/ar locale files, mirroring the structure inserted into es.ts.
import { readFileSync, writeFileSync } from 'node:fs';

const blocks = {
  en: {
    palette: ' "commandPalette": {\n  "title": "Global search",\n  "placeholder": "Search products, customers, invoices, repairs or quotes…",\n  "noResults": "No results",\n  "hint": "Type to search · open with Ctrl+K"\n },\n "validation": {',
    settings: `  "repairDetailHint": "Include the problem and diagnosis in the invoice",
  "verifactu": "Veri*factu (Spain)",
  "verifactuHint": "Chains every new invoice with a SHA-256 hash, record by record (RD 1007/2023). Existing invoices stay as they are.",
  "vfRegime": "VAT regime",
  "vfExport": "Export CSV record",
  "vfChainNote": "Verifies and exports the full fingerprint",
  "vfBroken": "⚠️ Broken chain at invoice {{number}}",
  "vfEmpty": "No invoices registered yet",
  "vfOk": "Veri*factu record exported ({{n}} invoices) ✓",
  "extBackup": "Scheduled external copy",
  "extBackupHint": "Each daily snapshot is also saved to the folder you choose (Documents/ShopLogic Backups on desktop; a granted folder in browsers).",
  "extBackupUnsupported": "This environment cannot pick an external folder (desktop or PWA with File System Access only).",
  "extBackupDir": "Destination folder",
  "extBackupLast": "Last copy",
  "extBackupPick": "Choose folder",
  "extBackupNow": "Copy now",
  "extBackupReady": "Folder ready:",
  "extBackupDone": "External copy written ✓",`,
  },
  pt: {
    palette: ' "commandPalette": {\n  "title": "Pesquisa global",\n  "placeholder": "Pesquise produtos, clientes, faturas, reparações ou orçamentos…",\n  "noResults": "Sem resultados",\n  "hint": "Escreva para pesquisar · abra com Ctrl+K"\n },\n "validation": {',
    settings: `  "repairDetailHint": "Inclui o problema e diagnóstico na fatura",
  "verifactu": "Veri*factu (Espanha)",
  "verifactuHint": "Encadeia cada fatura nova com um hash SHA-256, registo a registo (RD 1007/2023). As existentes permanecem como estão.",
  "vfRegime": "Regime do IVA",
  "vfExport": "Exportar registo CSV",
  "vfChainNote": "Verifica e exporta a impressão integral",
  "vfBroken": "⚠️ Cadeia quebrada na fatura {{number}}",
  "vfEmpty": "Ainda não há faturas registadas",
  "vfOk": "Registo Veri*factu exportado ({{n}} faturas) ✓",
  "extBackup": "Cópia externa programada",
  "extBackupHint": "Cada snapshot diário também é guardado na pasta que escolher (Documents/ShopLogic Backups no desktop; pasta concedida no navegador).",
  "extBackupUnsupported": "Este ambiente não permite escolher uma pasta externa (só desktop ou PWA com File System Access).",
  "extBackupDir": "Pasta de destino",
  "extBackupLast": "Última cópia",
  "extBackupPick": "Escolher pasta",
  "extBackupNow": "Copiar agora",
  "extBackupReady": "Pasta pronta:",
  "extBackupDone": "Cópia externa escrita ✓",`,
  },
  zh: {
    palette: ' "commandPalette": {\n  "title": "全局搜索",\n  "placeholder": "搜索商品、客户、发票、维修或报价…",\n  "noResults": "无结果",\n  "hint": "输入以搜索 · 用 Ctrl+K 打开"\n },\n "validation": {',
    settings: `  "repairDetailHint": "在发票中包含故障与诊断",
  "verifactu": "Veri*factu（西班牙）",
  "verifactuHint": "为每张新发票逐条链入 SHA-256 哈希（RD 1007/2023）。已有发票保持不变。",
  "vfRegime": "增值税制度",
  "vfExport": "导出 CSV 记录",
  "vfChainNote": "校验并导出完整指纹",
  "vfBroken": "⚠️ 发票 {{number}} 哈希链断裂",
  "vfEmpty": "尚无已登记发票",
  "vfOk": "Veri*factu 记录已导出（{{n}} 张发票）✓",
  "extBackup": "定时外部备份",
  "extBackupHint": "每份每日快照也会保存到您选择的文件夹（桌面端为 Documents/ShopLogic Backups；浏览器为已授权文件夹）。",
  "extBackupUnsupported": "当前环境无法选择外部文件夹（仅桌面端或支持 File System Access 的 PWA）。",
  "extBackupDir": "目标文件夹",
  "extBackupLast": "上次备份",
  "extBackupPick": "选择文件夹",
  "extBackupNow": "立即备份",
  "extBackupReady": "文件夹就绪：",
  "extBackupDone": "外部备份已写入 ✓",`,
  },
  ar: {
    palette: ' "commandPalette": {\n  "title": "بحث شامل",\n  "placeholder": "ابحث في المنتجات والعملاء والفواتير والإصلاحات وعروض الأسعار…",\n  "noResults": "لا نتائج",\n  "hint": "اكتب للبحث · افتح مع Ctrl+K"\n },\n "validation": {',
    settings: `  "repairDetailHint": "يضمّن المشكلة والتشخيص في الفاتورة",
  "verifactu": "Veri*factu (إسبانيا)",
  "verifactuHint": "يربط كل فاتورة جديدة ببصمة SHA-256 سجلًا بعد سجل (RD 1007/2023). الفواتير الموجودة تبقى كما هي.",
  "vfRegime": "نظام الضريبة",
  "vfExport": "تصدير السجل CSV",
  "vfChainNote": "يتحقق ويصدّر البصمة الكاملة",
  "vfBroken": "⚠️ السلسلة مكسورة في الفاتورة {{number}}",
  "vfEmpty": "لا فواتير مسجلة بعد",
  "vfOk": "سجل Veri*factu مُصدَّر ({{n}} فاتورة) ✓",
  "extBackup": "نسخة خارجية مجدولة",
  "extBackupHint": "كل لقطة يومية تُحفظ أيضًا في المجلد الذي تختاره (Documents/ShopLogic Backups في سطح المكتب؛ مجلد مُصرّح به في المتصفح).",
  "extBackupUnsupported": "هذه البيئة لا تتيح اختيار مجلد خارجي (سطح المكتب أو PWA مع File System Access فقط).",
  "extBackupDir": "مجلد الوجهة",
  "extBackupLast": "آخر نسخة",
  "extBackupPick": "اختيار مجلد",
  "extBackupNow": "النسخ الآن",
  "extBackupReady": "المجلد جاهز:",
  "extBackupDone": "النسخة الخارجية كُتبت ✓",`,
  },
};

for (const [lang, { palette, settings }] of Object.entries(blocks)) {
  const path = new URL(`../src/i18n/${lang}.ts`, import.meta.url);
  let src = readFileSync(path, 'utf8');
  if (src.includes('"commandPalette"')) { console.log(`${lang}: already present, skip`); continue; }
  if (!src.includes('"validation": {')) throw new Error(`${lang}: anchor "validation" missing`);
  if (!src.includes('"repairDetailHint"')) throw new Error(`${lang}: anchor "repairDetailHint" missing`);
  src = src.replace(' "validation": {', palette);
  src = src.replace(/(  "repairDetailHint": "[^"\n]*",\n)/, settings + '\n');
  writeFileSync(path, src);
  console.log(`${lang}: keys added`);
}
