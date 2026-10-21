# 📱 ShopLogic Pro v1.3.5

<p align="center">
  <img src="public/icon-512.png" width="128" alt="ShopLogic Pro">
</p>

**Full ERP + POS for mobile phone and accessory shops** — sales, cash register, traceable inventory, repair workshop, invoicing with Veri*factu, 303/347 fiscal reports, second-hand purchases and messaging automations. Runs 100% locally (your data never leaves your machine) and updates itself from GitHub Releases.

> 🌍 **Languages / Idiomas / 语言 / اللغات**: [Español](README.md) · [Português](README-pt.md) · [中文](README-zh.md) · [العربية](README-ar.md)

[![Release](https://img.shields.io/github/v/release/jimelyo/shoplogic)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Platform](https://img.shields.io/badge/Windows-x64%20%7C%20arm64-blue)](https://github.com/jimelyo/shoplogic/releases/latest)
[![macOS](https://img.shields.io/badge/macOS-DMG%20x64%20%7C%20arm64-lightgrey)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Android](https://img.shields.io/badge/Android-APK%20v1.3.5-green)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Languages](https://img.shields.io/badge/languages-5%20·%20Arabic%20RTL-purple)](#-languages)
[![License](https://img.shields.io/badge/use-private-informational)]()

---

## ✨ Features

### 🛒 Point of Sale (POS)
- **One-tap checkout** from product cards or table, with a catalog filtered by categories.
- **Split payments**: charge a sale with several methods at once (e.g. €20 cash + rest by card), validated before charging and shown on the receipt.
- Percent or fixed-amount discounts, VAT included with on-screen breakdown.
- **Code scanning**: via USB reader (types into the search box) or with the **camera** (EAN/UPC/Code128/QR codes and IMEI) through the native `BarcodeDetector` API.
- **Keyboard shortcuts**: `F1` search · `F2` charge · `F3` scan · `F4` empty cart.
- Automatic loyalty points per purchase amount.
- Printable receipt (58/80 mm) with logo, and sending the receipt via **WhatsApp or email**.

### 📋 Quotes
- Create a **sale or repair** quote with lines, validity and notes.
- Flow: draft → sent → accepted → **convert with one click**:
  - → **Sale** (deducts stock in an atomic transaction)
  - → **Repair** (creates the ticket pre-filled with device/IMEI/problem/cost)
- Automatic expiry and a printable quote in receipt style.

### 📦 Inventory and stock movements
- Products with barcode, IMEI, cost, retail price (VAT incl.), minimum stock and calculated margins.
- Low/out-of-stock alerts with automatic notifications.
- **Per-product movement history** (ledger): sales, purchases, adjustments, returns and second-hand purchases with previous/next balance.
- Custom categories with icon and color.
- Camera scanner to look up products.

### 🔧 Repair workshop
- Tickets `R-000001` with customer, device, IMEI, problem, diagnostics and status flow (received → diagnosis → in progress → waiting for parts → completed → delivered).
- **Print the intake ticket** when registering the repair (optional right in the creation dialog, meant for when the customer is still at the counter) with a **preview** before printing.
- Customer notification by WhatsApp/email on completion (automatable), with a printable receipt.
- **History by IMEI** page with configurable warranty.
- Automatic invoicing on delivery (optional).

### 💶 Cash register
- Shift open/close with opening float, deposits and withdrawals.
- Expected vs counted reconciliation with a computed difference, split by cash sales, invoices and returns.

### 🧾 Invoicing and rectifications
- Configurable numbering (sequential, by date, by year or custom format), series and prefixes.
- Statuses (draft, sent, paid, partial, overdue, cancelled) with partial payments.
- **Professional PDF** with watermark, standard copies and the sales receipt.
- **Statutory QR** on the PDF: official AEAT verification URL (35 mm, level M) + official legend "Invoice verifiable on the AEAT electronic office".
- **Rectifications R1–R5 (by differences)**: issue corrective invoices from Billing and get them **generated automatically** for partial or full returns, chained into Veri*factu.

### 🛍️ Second-hand purchases (trade-in)
- A dedicated module to **appraise, buy and restock** second-hand devices and accessories, right in the main menu.
- Appraisal with breakdown (cost + target margin), purchase registration for the supplier/individual, and **direct addition to inventory** with its IMEI.
- Full stock traceability: every purchase is recorded as a `trade_in` movement in the product ledger, with origin (individual) and price paid.
- Integrated with the POS: the purchased item can be sold like any other product.

### 📈 Reports / fiscal reports
- Sales, profit, margin, sales by category, repairs by status.
- **Model 303 (quarterly VAT)**: quarterly settlement with output VAT and deductible input VAT, **PDF/CSV** export.
- **Model 347**: annual declaration of third-party operations (operations > €3,005 per customer/supplier), **PDF/CSV** export.
- Financial summary (income, expenses, balance) and **PDF export of any report**.

### 🇪🇸 Veri*factu — Spain (RD 1007/2023 · Order HAC/1177/2024)
Full fiscal module compliant with the official AEAT technical documents:
- **Official SHA-256 fingerprint**: the `field=value&…` chain in the exact order of AEAT doc v0.1.2, UTF-8, uppercase hex. Reproduces the **3 official test vectors** (initial alta, chained alta, chained cancellation).
- **Record-by-record chaining** (`chainAlta`/`chainAnulacion`) with integral sensitivity to any modified field.
- **XML** of `RegistroAlta`/`RegistroAnulacion`/batch (≤ 1000 records) per the `SuministroLR.xsd`/`SuministroInformacion.xsd` schemas, validated against the official example of doc v1.0.3. **Rectifications** (R1–R5) chain with their reference to the original invoice.
- **SOAP** to the official WSDL endpoints (pre-production `prewww1.aeat.es` / production `www1.agenciatributaria.gob.es`) with a `RespuestaSuministro` parser (`Correcto` / `AceptadoConErrores` / `Incorrecto`) and per-record error detail.
- **Persistent, recoverable queue** across restarts: states `PERSISTED → QUEUED → SENDING → ACCEPTED / ACCEPTED_WITH_ERRORS / REJECTED / RETRY_PENDING` with 15 s → 1 min → 10 min → 1 h backoff. The invoice is **always** persisted (outbox pattern): if the fiscal submission fails it is never lost or duplicated.
- **XAdES-Enveloped signing** (ETSI EN 319 132) with xml-crypto + node-forge in the Electron main process, loading a local `.p12/.pfx` certificate (see the [step-by-step guide](README.md)). The private key never leaves the main process.
- **Companion**, incidents screen, status panel and the SIF producer's responsible declaration (see v1.3.2 history).
- **AEAT verification QR** on each invoice PDF.

### 🤖 Automations and messaging
- **Workshop stage notifications**: every repair status change can automatically notify the customer:
  - 📥 Received → WhatsApp
  - 🛠️ In progress → WhatsApp + Email
  - ⏰ Waiting for parts → WhatsApp + Email
  - ✅ Ready / Completed → WhatsApp + Email (summary with final cost)
- Additional configurable automations: sale receipts via WhatsApp, daily summary, daily backup, stock alerts, overdue invoices…
- **WhatsApp** in two modes: direct `wa.me` link (no server) or the official **Cloud API**.
- **Email** with Gmail/Outlook/generic SMTP presets. The local **SMTP relay** listens only on `127.0.0.1` and validates the `Origin` header of every send.
- Send queue (outbox) with retries on restart if the relay server was unavailable.
- Every use is recorded in the audit log (who sent what and when).

### ⚙️ Settings and data
- **Scheduled backup** plus **optional AES-256-GCM encrypted backups** (key derived with PBKDF2-SHA256, 310,000 iterations) with an encrypt/decrypt UI in Settings.
- Multiple currencies (EUR, USD, GBP, MXN, ARS, COP, CLP, BRL, CNY, MAD), configurable VAT. Own branding: app name, logo, store fiscal details on receipts/PDF.
- Light/dark theme + 6 accent colors.
- Idle lock screen with password.
- Role-based RBAC: **admin, manager, technician, cashier**, with a permission matrix editable module by module.
- Data management: full JSON export/import, **per-table CSV export (Excel)**, selective reset with an automatic prior backup.
- Audit: log of actions (logins, sales, edits, sends, prints) with user and date.

### 🌍 Languages

The app is **fully translated into 5 languages** (≈ 1,016 keys synchronized by `npm run check:i18n`), selectable from the login screen and the side menu:

| Code | Language | Flag | RTL |
|---|---|---|---|
| `es` | Spanish (default) | 🇪🇸 | — |
| `en` | English | 🇬🇧 | — |
| `pt` | Portuguese | 🇵🇹 | — |
| `zh` | Chinese | 🇨🇳 | — |
| `ar` | Arabic | 🇸🇦 | ✓ **full RTL** |

- The language is stored in `localStorage` (`sl_lang`) and persists between sessions; Arabic flips the page direction (`dir=rtl`) and all styles adapt with Tailwind logical utilities (`ms-`, `me-`, `start-`, `end-`).
- Receipts, invoice PDFs and automatic WhatsApp/email messages also follow the active language.
- Automatic fallback to Spanish if a key is missing.

### 🔄 Auto-updates
- **Desktop (Electron)**: polls GitHub Releases on startup and every 30 min; background download with **differential download** (blockmaps), visible progress and a dismissible per-version banner; installation applies on app close with a **single UAC** (one-click installer, no wizard).
- **PWA (browser)**: the service worker detects the new version and applies it on reload (automatic if enabled in Appearance → Update).
- **Truly offline**: the service worker precaches all assets — works without connection from the first visit.

---

## 🔐 Security and privacy

- **100% local**: the database lives in IndexedDB of your browser/machine. Nothing is sent to any server (WhatsApp/email messages go out directly from your machine or your own relay).
- Passwords use **PBKDF2-SHA256 (210,000 iterations)** + per-user random salt, constant-time comparison and automatic upgrade of old hashes.
- **Temporary login lockout** after repeated failures (exponential delay `30 s·2ⁿ`): slows offline brute-force without locking out the legitimate user.
- **Messaging credentials are masked** in the on-disk daily snapshot; the full manual backup includes them only if you ask for it, with a warning in the UI.
- **The `.p12` certificate password is encrypted with safeStorage** (Windows DPAPI / macOS Keychain) and never stored in clear text.
- **Optional AES-256-GCM encrypted backups** (PBKDF2 310k) — if you set a password on the backup, the exported file is unreadable without it.
- **Veri*factu**: the AEAT `.p12` certificate is read only in the Electron main process; the private key never reaches the renderer. Without a signer configured the queue stays in `RETRY_PENDING` (it never fakes an acceptance).
- The local **SMTP relay** only accepts `127.0.0.1` connections and rejects requests with an external `Origin`.
- Imported backups are **validated row by row** before restoring.
- Electron with `contextIsolation` + sandbox and no Node integration in the renderer.

---

## 🚀 Installation

### 📱 Android
1. Download **`shoplogic-pro-v1.3.5-android.apk`** from [Release v1.3.5](https://github.com/jimelyo/shoplogic/releases/tag/v1.3.5). ⚠️ v1.3.5 is signed with a **new keystore**: it does not install over the official v1.2.0 (different signature) — uninstall first if you came from that version.
2. Allow **installing apps from unknown sources** for your browser/file manager (Settings → Security) the first time.
3. Open the APK and install it. Requires **Android 6.0+ (API 23+)**. No permissions beyond internet: data lives in IndexedDB inside the app, 100% local.

### Windows (recommended — desktop)
1. Download the **v1.3.4 installer** for your architecture (x64 and ARM64 packaged in the same release) from [Releases](https://github.com/jimelyo/shoplogic/releases/latest):
   - `ShopLogic-Setup-1.3.5-x64.exe` (Windows 10/11 x64)
   - `ShopLogic-Setup-1.3.5-arm64.exe` (Windows on ARM)
2. Run the installer (silent install with a single UAC). The shortcut lands on the desktop.
3. Updates are downloaded and applied **automatically** from then on (v1.3.3 and earlier auto-update through the same electron-updater channel).

### macOS
1. Download the **v1.3.4 DMG** for your architecture from [Releases](https://github.com/jimelyo/shoplogic/releases/latest):
   - `ShopLogic-1.3.5-x64.dmg` (Intel)
   - `ShopLogic-1.3.5-arm64.dmg` (Apple Silicon)
2. Open the DMG and drag the app to Applications. Subsequent updates are also automatic (`latest-mac.yml`).
3. ⚠️ The DMG is **not yet notarized by Apple**: the first time macOS will ask "System Settings → Privacy & Security → Open Anyway".

### Browser (PWA)
- Serve the static build (`dist/`) with any web server; it also works opening the local `index.html`.
- Installable as an app from Chrome/Edge ("Install ShopLogic Pro").

### First launch
The app loads demo data (phones, customers, repairs, invoices…) and these users:

| Email | Password | Role |
|---|---|---|
| `admin@shoplogic.com` | `admin123` | Administrator (all) |
| `manager@shoplogic.com` | `manager123` | Manager |
| `tecnico@shoplogic.com` | `tecnico123` | Technician |
| `cajero@shoplogic.com` | `cajero123` | Cashier |

> ⚠️ **Change those passwords or delete those users before using the app in production** (Users → edit).

---

## 🇪🇸 Veri*factu — Step-by-step guide (AEAT certificate + signed submission)

The full guide lives in the [Spanish README](README.md): enable Veri*factu in Settings → Billing, install your `.p12` certificate (either through the 🧙 VERI*FACTU Companion wizard, which validates the password and writes `verifactu/signer.json` securely, or by hand at `%APPDATA%\shoplogic\verifactu\signer.json`), then submit a test invoice against the AEAT pre-production endpoint (`prewww1.aeat.es`). Since v1.3.5 the certificate password is stored **encrypted with safeStorage** (DPAPI/Keychain) instead of plain text.

---

## 🛠️ Development

```bash
npm install          # dependencies
npm run dev          # Vite dev server (PWA in the browser)
npm run start        # applies the build to local Electron
npm run build        # production build (tsc + vite)
npm run dist         # packages Windows x64 + arm64 with electron-builder
npm test             # unit tests (vitest)
npm run lint         # oxlint
npm run check:i18n   # checks 5 locales have identical keys
```

### macOS build (DMG)

```bash
npm run build                   # web build to dist/
npx electron-builder --mac --x64 --arm64   # DMG x64 + arm64 in release/
```

### Android build (Capacitor)

Requires a JDK 21 (system Java 25 is still incompatible with AGP) and wraps the web build in a native shell:

```bash
npm run build                    # web build to dist/
npx cap sync android             # copies dist/ + plugins into the Android project
export JAVA_HOME="$USERPROFILE/.jdks/jbr-21.0.11"     # JDK 21
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"       # Android SDK
export SL_KEYSTORE="$USERPROFILE/.android/shoplogic-release.jks"  # keystore outside the repo
export SL_KEYSTORE_PASS=…; export SL_KEY_ALIAS=shoplogic; export SL_KEY_PASS=…
cd android && ./gradlew assembleRelease      # signed APK in app/build/outputs/apk/release/
```

### Stack
- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + Zustand.
- **Data**: Dexie (IndexedDB) with atomic transactions; typed models in `src/types`.
- **Desktop**: Electron 44 + electron-updater with GitHub Releases.
- **Taxation**: the `src/verifactu/` module (AEAT fingerprint, chaining, XML, SOAP, queue, QR) + XAdES signing in the main process (`xml-crypto` + `node-forge`).
- **Mobile**: Capacitor 8 (`capacitor.config.ts` + `android/` project), APK signed with keystore via environment variables.
- **i18n**: i18next + react-i18next, 5 typed resources in `src/i18n` (es · en · pt · zh · ar with RTL).
- **Testing**: Vitest + fake-indexeddb (155 tests), including backup, credentials, AEAT fingerprint, XAdES signing, rectification and trade-in tests.

### Structure
```
src/
├── components/    # 25+ UI modules (POS, Cash, Inventory, Repairs, Quotes, Billing, Reports, TradeIns…)
├── verifactu/     # Veri*factu fiscal module: fingerprint, chain, XML, SOAP, queue, QR (+ tests)
├── lib/           # core logic: calc, stock, invoices, cash, messaging, backup, csv, update, tradein…
├── db/            # Dexie schema + demo data
├── i18n/          # es, en, pt, zh, ar (1,016 synchronized keys)
├── schemas/       # Zod validation for every form
└── types/         # typed domain models
electron/          # main process, preload, updater and XAdES signer
android/           # native Android project (Capacitor, signed Gradle build)
server/            # local SMTP relay (127.0.0.1) for email sends
public/            # service worker + manifest
```

---

## 📋 What's new / Changelog (v1.3.5)

### 🔧 Labor costs in repairs
- Each repair can mark labor as **included in the price** (informational) or **separate** (added on top): amount, live VAT breakdown, its own line on the automatic invoice and on the printed receipt.
- Hardening: production CSP, SHA-256 digest backups with masked credentials, per-action permissions and lazy i18n.


### 🛍️ Second-hand purchases (trade-in)
- Module renamed to **"2nd-hand purchases"** (navigation in all 5 languages) to appraise, buy and restock second-hand devices.
- Appraisal with cost + margin, purchase registration and **direct addition to inventory** with the IMEI.
- **Full traceability**: every purchase is recorded as a `trade_in` ledger movement with origin and price paid.

### 🧾 Rectifications R1–R5
- Issue **rectifying invoices (by differences)** from Billing, and **automatic detection** on partial/full returns: the rectification is generated on its own and queued in Veri*factu with its reference to the original invoice.

### 📈 Fiscal reports
- **Model 303 (quarterly VAT)** and **Model 347 (third-party operations)** in Reports, with **PDF and CSV** export ready for the declaration.

### 🔐 Security hardening
- The Veri*factu `.p12` certificate password is now **encrypted with safeStorage** (DPAPI/Keychain) instead of plain text.
- The local **SMTP relay** listens only on `127.0.0.1` and validates the `Origin` header.
- **Temporary login lockout** after repeated failures (backoff `30 s·2ⁿ`).
- **Optional AES-256-GCM encrypted backups** (PBKDF2 310k) with an encrypt/decrypt UI in Settings.

### 🎨 New visual identity
- New corporate logo on Electron (ico/icns), PWA, Android (mipmaps + splash) and the GitHub social preview.

### Multi-platform packaging
- NSIS Windows **x64 and ARM64** installers + **macOS DMG x64/arm64** + **Android APK** (versionCode 134) and desktop auto-update via `latest.yml` / `latest-mac.yml`.

---

## 🗺️ Release history

| Version | Main changes |
|---|---|
| **v1.3.5** (Windows x64/ARM64 + macOS x64/ARM64 + Android) | **Labor costs in repairs** (included or separate, on invoices and receipts) · hardening: production CSP, SHA-256 digest backups + masked credentials, per-action permissions, atomic invoice numbering · lazy i18n |
| **v1.3.4** (Windows x64/ARM64 + macOS x64/ARM64 + Android) | **Second-hand purchases** (trade-in with inventory intake and traceability) · **rectifications R1–R5** with automatic detection on returns · **fiscal reports Models 303 and 347** · security hardening (safeStorage, localhost SMTP, login lockout, AES-256-GCM backups) · new logo on all platforms |
| **v1.3.3** (Windows) | **Repair ticket printing**: option when creating + modal preview · ticket header synced with the real store name |
| **v1.3.2** (Windows x64 + ARM64) | **VERI*FACTU Companion**: `.p12` certificate wizard secured in the main process · AEAT queue diagnostics + connection test · incidents center with XML viewer · exportable responsible declaration · multi-architecture x64/ARM64 packaging |
| **v1.3.0** (Windows) | **Full Veri\*factu (RD 1007/2023)**: official SHA-256 fingerprint with AEAT vectors · chaining · XML/SOAP SuministroLR · persistent queue with retries · statutory QR on PDF · incidents screen with AEAT errors · **XAdES-Enveloped signer** with local `.p12` |
| **v1.2.0** (Windows + Android) | **Ctrl+K global search** · **scheduled external backup** · **Veri*factu (Spain)** with chained SHA-256 fingerprints · Dexie indexes for large catalogs · release CI workflow |
| **v1.1.0** (Windows) | Login by user selection + password · demo notice removed |
| **v1.0.6** | Workshop stage notifications (received/in progress/waiting for parts) on WhatsApp + email · regenerated icon |
| **v1.0.5** | New corporate icon (phone + wrench + chart) on installer, window and PWA |
| **v1.0.4** | One-click installer (single-UAC auto-update) · full README |
| **v1.0.3** | Quotes convertible to sale/repair · split payments in POS · F1-F4 shortcuts · per-table CSV · masked credentials in backups · true offline PWA |
| **v1.0.2** | Version visible in the sidebar · non-forced update banner |
| **v1.0.1** | Auto-update via GitHub Releases with electron-updater |

## 📄 License
Private project. All rights reserved.
