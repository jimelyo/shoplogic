# 📱 ShopLogic Pro

<p align="center">
  <img src="public/icon-512.png" width="128" alt="ShopLogic Pro">
</p>

> 🌍 **Languages**: [Español](README.md) · [Português](README-pt.md) · [中文](README-zh.md) · [العربية](README-ar.md)

**Complete ERP + POS for phone and accessory shops** — sales, cash registers, inventory with traceability, repair workshop, invoicing, reports and messaging automations. Runs 100% locally (your data never leaves your machine) and updates itself from GitHub Releases.

[![Release](https://img.shields.io/github/v/release/jimelyo/shoplogic)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Platform](https://img.shields.io/badge/Windows-x64%20%7C%20arm64-blue)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Android](https://img.shields.io/badge/Android-APK%20v1.2.0-green)](https://github.com/jimelyo/shoplogic/releases/tag/v1.2.0)
[![Languages](https://img.shields.io/badge/languages-5%20%C2%B7%20RTL%20Arabic-purple)](#-languages)
[![License](https://img.shields.io/badge/use-private-informational)]()

---

## ✨ Features

### 🌍 Languages

The app is **fully translated into 5 languages** (~872 keys each, checked by `npm run check:i18n`), selectable on the login screen and from the sidebar:

| Code | Language | Flag | RTL |
|---|---|---|---|
| `es` | Spanish (default) | 🇪🇸 | — |
| `en` | English | 🇬🇧 | — |
| `pt` | Portuguese | 🇵🇹 | — |
| `zh` | Chinese | 🇨🇳 | — |
| `ar` | Arabic | 🇸🇦 | ✓ **full RTL** |

- The language is stored in `localStorage` (`sl_lang`) and persists across sessions; Arabic flips the page direction (`dir=rtl`) and every style adapts via Tailwind logical utilities (`ms-`, `me-`, `start-`, `end-`).
- Tickets, invoice PDFs and automatic WhatsApp/email messages also follow the active language.
- Automatic fallback to Spanish if a key is missing.

### 🛒 Point of Sale (POS)
- One-tap checkout from product cards or table, with catalog filtered by categories.
- **Split payments**: pay a sale with several methods at once (e.g. €20 cash + rest on card), validated split reflected on the receipt.
- Discounts by % or fixed amount, VAT included with on-screen breakdown.
- **Barcode scanning**: via USB reader (types into the search box) or **camera** (EAN/UPC/Code128/QR codes and IMEI) using the native `BarcodeDetector` API.
- **Keyboard shortcuts**: `F1` search · `F2` checkout · `F3` scan · `F4` clear cart.
- Automatic loyalty points per purchase amount.
- Printable receipt (58/80 mm) with logo, and receipt delivery via **WhatsApp or email**.

### 📋 Quotes
- Create a **sale or repair** quote with lines, validity and notes.
- Flow: draft → sent → accepted → **convert with one click**:
  - → **Sale** (deducts stock in an atomic transaction)
  - → **Repair** (creates the ticket pre-filled with device/IMEI/issue/cost)
- Automatic expiry and printable ticket-style quote.

### 📦 Inventory and movements
- Products with barcode, IMEI, cost, retail price (VAT incl.), minimum stock and calculated margins.
- Low/out-of-stock alerts with automatic notifications.
- **Per-product movement history** (ledger): sales, purchases, adjustments and returns with previous/subsequent balance.
- Customizable categories with icon and color.
- Camera scanner to look up products.

### 🔧 Repair workshop
- Tickets `R-000001` with customer, device, IMEI, issue, diagnosis and status flow (received → diagnosis → in progress → waiting for parts → completed → delivered).
- Customer notification by WhatsApp/email on completion (automatable), with printable receipt.
- **Per-IMEI history** page with configurable warranty.
- Automatic invoicing on delivery (optional).

### 💶 Cash register
- Shift open/close with float, deposits and withdrawals.
- Expected vs counted cash-up with calculated difference, split by sale (cash), invoices and returns.

### 🧾 Invoicing
- Configurable numbering (sequential, by date, by year or custom format), series and prefixes.
- Statuses (draft, sent, paid, partial, overdue, cancelled) with partial payments.
- **Professional PDF** with watermark, standard copies and sales receipt.

### 👥 Customers, suppliers and purchases
- Customer 360° page: total spend, visits, points, device history by IMEI.
- Suppliers with contacts and purchase orders with **partial receiving**.
- **Assisted restocking**: generates a draft order with all products below minimum stock in one click.

### 📈 Reports
- Sales, profit, margin, sales by category, repairs by status.
- Financial summary (income, expenses, balance) and **PDF export of any report**.

### 🤖 Automations and messaging
- **Workshop stage notifications**: every repair status change can notify the customer automatically:
  - 📥 Received → WhatsApp
  - 🛠️ In progress → WhatsApp + Email
  - ⏰ Waiting for parts → WhatsApp + Email
  - ✅ Ready / Completed → WhatsApp + Email (summary with final cost)
- Additional configurable automations: sale receipts via WhatsApp, daily summary, daily backup, stock alerts, overdue invoices…
- **WhatsApp** in two modes: direct `wa.me` link (no server) or official **Cloud API**.
- **Email** with Gmail/Outlook/generic SMTP presets.
- Delivery outbox queue with retries on restart if the relay server was unavailable.
- Every usage is recorded in the audit log (who sent what and when).

### ⚙️ Settings and data
- Multiple currencies (EUR, USD, GBP, MXN, ARS, COP, CLP, BRL, CNY, MAD), configurable VAT. Custom branding: app name, logo, shop tax details on tickets/PDF.
- Dark/light theme + 6 accent colors.
- Screen lock on inactivity with password.
- RBAC by roles: **admin, manager, technician, cashier**, with an editable module-by-module permission matrix.
- Data management: full JSON export/import, **per-table CSV export (Excel)**, selective reset with automatic prior backup.
- Audit log: every action (login, sales, edits, sends, prints) with user and date.

### 🔄 Auto-updates
- **Desktop (Electron)**: checks GitHub Releases on startup and every 30 min; background download with **differential download** (blockmaps), visible progress and dismissible per-version banner; installation applies on app close with a **single UAC** (one-click installer, no wizard).
- **PWA (browser)**: the service worker detects the new version and applies it on reload (automatic if enabled in Appearance → Update).
- **True offline**: the service worker precaches all assets — works without connection from the first visit.

---

## 🔐 Security and privacy

- **100% local**: the database lives in IndexedDB in your browser/machine. Nothing is sent to any server (WhatsApp/email messages go out directly from your machine or your own relay).
- Passwords use **PBKDF2-SHA256 (210,000 iterations)** + per-user random salt, constant-time comparison and automatic upgrade of old hashes.
- **Messaging credentials are masked** in the on-disk daily snapshot; the full manual backup includes them only if you ask for it, with a warning in the UI.
- Imported backups are **validated row by row** before restoring.
- Electron with `contextIsolation` + sandbox and no Node integration in the renderer.

---

## 🚀 Installation

### 📱 Android
1. Download **`shoplogic-pro-v1.2.0-android.apk`** from [Release v1.2.0](https://github.com/jimelyo/shoplogic/releases/tag/v1.2.0) (same signing key as v1.1.0: installs right on top).
2. Allow **installing apps from unknown sources** for your browser/file manager (Settings → Security) the first time.
3. Open the APK and install it. Requires **Android 6.0+ (API 23+)**. No permissions beyond internet: data lives in IndexedDB inside the app, 100% local.

### Windows (recommended — desktop)
1. Download the installer for your architecture from [Releases](https://github.com/jimelyo/shoplogic/releases/latest):
   - `ShopLogic-Setup-x.y.z-x64.exe` (Windows 10/11 x64)
   - `ShopLogic-Setup-x.y.z-arm64.exe` (Windows on ARM)
2. Run the installer (silent install with a single UAC). The shortcut lands on the desktop.
3. Updates are downloaded and applied **automatically** from then on.

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
- **Mobile**: Capacitor 8 (`capacitor.config.ts` + `android/` project), APK signed with keystore via environment variables.
- **i18n**: i18next + react-i18next, 5 typed resources in `src/i18n` (es · en · pt · zh · ar with RTL).
- **Testing**: Vitest + fake-indexeddb (78 tests), including backup and credential tests.

### Structure
```
src/
├── components/    # 25+ UI modules (POS, Cash, Inventory, Repairs, Quotes, Billing, Reports…)
├── lib/           # core logic: calc, stock, invoices, cash, messaging, backup, csv, update…
├── db/            # Dexie schema + demo data
├── i18n/          # es, en, pt, zh, ar (872 synchronized keys)
├── schemas/       # Zod validation for every form
└── types/         # typed domain models
electron/          # main process, preload and updater
android/           # native Android project (Capacitor, signed Gradle build)
public/            # service worker + manifest
```

---

## 🗺️ Release history

| Version | Main changes |
|---|---|
| **v1.2.0** (Windows + Android) | **Ctrl+K global search** · **scheduled external backup** · **Veri\*factu (Spain)** with chained SHA-256 fingerprints · Dexie indexes for large catalogs · release CI workflow |
| **v1.1.0** (Windows) | Login by user selection + password · demo notice removed |
| **v1.0.6** | Workshop stage notifications (received/in progress/waiting for parts) on WhatsApp + email · regenerated icon |
| **v1.0.5** | New corporate icon (phone + wrench + chart) on installer, window and PWA |
| **v1.0.4** | One-click installer (single-UAC auto-update) · full README |
| **v1.0.3** | Quotes convertible to sale/repair · split payments in POS · F1-F4 shortcuts · per-table CSV · masked credentials in backups · true offline PWA |
| **v1.0.2** | Version visible in the sidebar · non-forced update banner |
| **v1.0.1** | Auto-update via GitHub Releases with electron-updater |

## 📄 License
Private project. All rights reserved.
