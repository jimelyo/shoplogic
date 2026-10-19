# 📱 ShopLogic Pro v1.3.4

<p align="center">
  <img src="public/icon-512.png" width="128" alt="ShopLogic Pro">
</p>

> 🌍 **语言 / Languages / Idiomas / اللغات**: [Español](README.md) · [English](README-en.md) · [Português](README-pt.md) · [العربية](README-ar.md)

**面向手机及配件商店的全功能 ERP + 收银系统** — 销售收银、库存溯源、维修工单、Veri*factu 开票、303/347 财务报表、二手收购和消息自动化。完全本地运行（数据绝不离开您的设备），并从 GitHub Releases 自动更新。

[![Release](https://img.shields.io/github/v/release/jimelyo/shoplogic)](https://github.com/jimelyo/shoplogic/releases/latest)
[![平台](https://img.shields.io/badge/Windows-x64%20%7C%20arm64-blue)](https://github.com/jimelyo/shoplogic/releases/latest)
[![macOS](https://img.shields.io/badge/macOS-DMG%20x64%20%7C%20arm64-lightgrey)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Android](https://img.shields.io/badge/Android-APK%20v1.3.4-green)](https://github.com/jimelyo/shoplogic/releases/latest)
[![语言](https://img.shields.io/badge/语言-5%20·%20阿拉伯语%20RTL-purple)](#-语言)
[![许可](https://img.shields.io/badge/使用-私人-informational)]()

---

## ✨ 功能

### 🛒 收银台（POS）
- 从商品卡片或表格**一键收款**，目录按分类过滤。
- **组合支付**：一次销售同时使用多种支付方式（例如 20 € 现金 + 其余刷卡），收款前验证分摊并在小票中体现。
- 按百分比或固定金额折扣，含税内含并屏幕分项展示。
- **条码扫描**：通过 USB 扫码枪（输入到搜索框）或**摄像头**（EAN/UPC/Code128/QR 及 IMEI）借助原生 `BarcodeDetector` API。
- **快捷键**：`F1` 搜索 · `F2` 收款 · `F3` 扫描 · `F4` 清空购物车。
- 按消费金额自动累积会员积分。
- 可打印小票（58/80 mm）带 logo，收据可通过 **WhatsApp 或邮件**发送。

### 📋 报价单
- 创建**销售或维修**报价，含明细行、有效期和备注。
- 流程：草稿 → 已发送 → 已接受 → **一键转换**：
  - → **销售**（原子事务扣减库存）
  - → **维修**（创建工单，预填设备/IMEI/故障/费用）
- 自动过期，报价单可按小票样式打印。

### 📦 库存与流水
- 商品含条码、IMEI、成本、售价（含税）、最低库存和自动计算的毛利。
- 低库存/缺货告警，自动通知。
- **按商品的流水记录**（ledger）：销售、采购、调整、退货和二手收购，含前后余额。
- 分类可自定义图标和颜色。
- 摄像头扫码查询商品。

### 🔧 维修车间
- 工单 `R-000001`，含客户、设备、IMEI、故障、诊断和状态流转（已接收 → 诊断 → 处理中 → 等待配件 → 已完成 → 已交付）。
- **打印受理小票**：在创建维修时就地提供打印选项（适合客户仍在前台的场景），打印前可**预览**。
- 完成时通过 WhatsApp/邮件自动通知客户（可自动化），附可打印回执。
- **按 IMEI 的历史**页面，保修可配置。
- 交付时自动开票（可选）。

### 💶 钱箱
- 班次开/关，含备用金、入金和取款。
- 应收与实收盘点并计算差额，按现金销售、发票和退货分别结算。

### 🧾 开票与更正发票
- 编号可配置（顺序、按日期、按年份或自定义格式），系列和前缀。
- 状态（草稿、已发送、已支付、部分、逾期、已取消），支持部分收款。
- **专业 PDF** 带水印、标准联数和销售小票。
- **QR 法定验证码**：AEAT 官方核验 URL（35 mm，级别 M）+ 官方声明「Factura verificable en la sede electrónica de la AEAT」。
- **R1–R5 更正发票（差额法）**：可从开票模块开具更正发票，部分/全额退货时可**自动生成**更正发票，并按链条加入 Veri*factu 队列。

### 🛍️ 二手收购（trade-in）
- 专用模块，直接在主菜单里**估价、收购和补货**二手设备及配件。
- 估价含明细（成本 + 目标毛利），登记向供应商/个人的采购，并将设备**直接入库**（含 IMEI）。
- 库存全程溯源：每笔收购按 `trade_in` 流水记入商品台账，含来源（个人）与支付价格。
- 与收银台集成：收购的商品可与其他商品一样销售。

### 📈 报表 / 财务报表
- 销售、利润、毛利、按分类销售、按状态维修。
- **303 表格（季度增值税）**：按季度结算销项税和可抵扣进项税，可导出 **PDF/CSV**。
- **347 表格**：年度第三方交易申报（每客户/供应商交易 > 3.005 €），可导出 **PDF/CSV**。
- 财务汇总（收入、支出、结余）及任何报表的 **PDF 导出**。

### 🇪🇸 Veri*factu — 西班牙（RD 1007/2023 · Orden HAC/1177/2024）
符合 AEAT 官方技术文档的完整财税模块：
- **官方 SHA-256 指纹**：`campo=valor&…` 串按 AEAT 文档 v0.1.2 的精确顺序，UTF-8、大写十六进制。复现 **3 个官方测试向量**（初始 alta、链式 alta、链式注销）。
- **逐条链式登记**（`chainAlta`/`chainAnulacion`），对任何字段修改全量敏感。
- **XML** `RegistroAlta`/`RegistroAnulacion`/批次（≤ 1000 条）符合 `SuministroLR.xsd`/`SuministroInformacion.xsd` 架构，并以官方文档 v1.0.3 示例校验。**更正发票**（R1–R5）链式登记并引用原发票。
- **SOAP** 调用官方 WSDL 端点（预生产 `prewww1.aeat.es` / 生产 `www1.agenciatributaria.gob.es`），解析 `RespuestaSuministro`（`Correcto` / `AceptadoConErrores` / `Incorrecto`）及逐条错误详情。
- **持久化、可恢复的队列**：状态 `PERSISTED → QUEUED → SENDING → ACCEPTED / ACCEPTED_WITH_ERRORS / REJECTED / RETRY_PENDING`，退避 15 秒 → 1 分 → 10 分 → 1 小时。发票**始终**先持久化（outbox 模式）：申报失败不会丢失或重复。
- **XAdES-Enveloped 签名**（ETSI EN 319 132），在 Electron 主进程用 xml-crypto + node-forge 加载本地 `.p12/.pfx` 证书。私钥绝不离开主进程。
- **Companion**、异常处理界面、状态面板及 SIF 生产者责任声明（见 v1.3.2 历史）。
- 每张发票 PDF 内含 **AEAT 核验 QR**。

### 🤖 自动化与消息
- **维修阶段通知**：工单每次状态变更可自动通知客户：
  - 📥 已接收 → WhatsApp
  - 🛠️ 处理中 → WhatsApp + 邮件
  - ⏰ 等待配件 → WhatsApp + 邮件
  - ✅ 已就绪 / 已完成 → WhatsApp + 邮件（含最终费用摘要）
- 其他可配置自动化：销售收据 WhatsApp 发送、日报、每日备份、库存告警、逾期发票…
- **WhatsApp** 两种模式：`wa.me` 直链（无需服务器）或官方 **Cloud API**。
- **邮件**支持 Gmail/Outlook/通用 SMTP 预设。本地 **SMTP relay** 仅监听 `127.0.0.1` 并校验每次发送的 `Origin` 头。
- 发送队列（outbox），重启时若中继不可用则自动重试。
- 所有使用记录在审计日志（谁在何时发送了什么）。

### ⚙️ 设置与数据
- **定时备份** + **可选 AES-256-GCM 加密备份**（密钥经 PBKDF2-SHA256，310,000 次迭代），设置页内置加密/解密界面。
- 多币种（EUR、USD、GBP、MXN、ARS、COP、CLP、BRL、CNY、MAD），税率可配置。自有品牌：应用名称、logo、商店税务信息显示在小票/PDF。
- 明暗主题 + 6 种强调色。
- 空闲锁定屏幕，需密码解锁。
- 基于角色的 RBAC：**管理员、经理、技师、收银员**，权限矩阵可按模块逐项编辑。
- 数据管理：完整 JSON 导出/导入、**按表的 CSV 导出（Excel）**、选择性重置并自动先备份。
- 审计：所有操作（登录、销售、修改、发送、打印）记录用户和时间。

### 🌍 语言

应用**完整翻译为 5 种语言**（每种约 1,016 个词条，由 `npm run check:i18n` 校验一致），可在登录界面和侧边栏切换：

| 代码 | 语言 | 旗帜 | RTL |
|---|---|---|---|
| `es` | 西班牙语（默认） | 🇪🇸 | — |
| `en` | 英语 | 🇬🇧 | — |
| `pt` | 葡萄牙语 | 🇵🇹 | — |
| `zh` | 中文 | 🇨🇳 | — |
| `ar` | 阿拉伯语 | 🇸🇦 | ✓ **完整 RTL** |

- 语言保存在 `localStorage`（`sl_lang`），跨会话保持；阿拉伯语会切换页面方向（`dir=rtl`），所有样式通过 Tailwind 逻辑工具类（`ms-`、`me-`、`start-`、`end-`）自适应。
- 小票、发票 PDF 以及自动 WhatsApp/邮件消息同样遵循当前语言。
- 缺少词条时自动回退到西班牙语。

### 🔄 自动更新
- **桌面端（Electron）**：启动时及每 30 分钟查询 GitHub Releases；后台下载并支持**差量下载**（blockmaps）、可见进度和按版本可关闭的横幅；关闭应用时安装，只需**一次 UAC**（一键安装器，无向导）。
- **PWA（浏览器）**：service worker 检测新版本并在刷新时应用（可在 外观 → 更新 中开启自动）。
- **真正的离线**：service worker 预缓存所有资源 — 首次访问后即可无网络运行。

---

## 🔐 安全与隐私

- **100% 本地**：数据库存放在浏览器的 IndexedDB。不向任何服务器发送数据（WhatsApp/邮件直接从您的机器或您自己的中继发出）。
- 密码采用 **PBKDF2-SHA256（210,000 次迭代）** + 每用户随机盐，常量时间比较，并自动升级旧哈希。
- **登录连续失败临时锁定**（指数延迟 `30 秒·2ⁿ`）：减缓离线暴力破解，不影响正常用户。
- 消息**凭据在磁盘每日快照中遮蔽显示**；完整手动备份仅在您明确要求时包含它们，UI 中有提示。
- **证书 `.p12` 密码用 safeStorage 加密保存**（Windows DPAPI / macOS 钥匙串），绝不明文存储。
- **可选 AES-256-GCM 加密备份**（PBKDF2 310k）— 若为备份设置密码，导出的文件无密码不可读。
- **Veri*factu**：AEAT 证书 `.p12` 仅在 Electron 主进程读取；私钥绝不进入渲染进程。未配置签名器时队列停留在 `RETRY_PENDING`（绝不伪造受理）。
- 本地 **SMTP relay** 仅接受 `127.0.0.1` 连接，拒绝外部 `Origin` 的请求。
- 导入的备份在恢复前**逐行校验**。
- Electron 启用 `contextIsolation` + 沙箱，渲染进程不集成 Node。

---

## 🚀 安装

### 📱 Android
1. 从 [Release v1.3.4](https://github.com/jimelyo/shoplogic/releases/tag/v1.3.4) 下载 **`shoplogic-pro-v1.3.4-android.apk`**。⚠️ v1.3.4 使用**新的 keystore 签名**：无法覆盖安装官方 v1.2.0（签名不同）— 如需升级请先卸载。
2. 首次安装时，允许浏览器/文件管理器**安装未知来源应用**（设置 → 安全）。
3. 打开 APK 安装。需要 **Android 6.0+（API 23+）**。除网络外无其他权限：数据保存在应用内的 IndexedDB，完全本地。

### Windows（推荐 — 桌面）
1. 从 [Releases](https://github.com/jimelyo/shoplogic/releases/latest) 下载适合您架构的 **v1.3.4 安装包**（x64 与 ARM64 在同一 release 内）：
   - `ShopLogic-Setup-1.3.4-x64.exe`（Windows 10/11 x64）
   - `ShopLogic-Setup-1.3.4-arm64.exe`（Windows on ARM）
2. 运行安装包（静默安装，仅一次 UAC）。快捷方式位于桌面。
3. 此后更新自动下载并应用（v1.3.3 及更早版本走同一 electron-updater 渠道也会自动升级）。

### macOS
1. 从 [Releases](https://github.com/jimelyo/shoplogic/releases/latest) 下载适合您架构的 **v1.3.4 DMG**：
   - `ShopLogic-1.3.4-x64.dmg`（Intel）
   - `ShopLogic-1.3.4-arm64.dmg`（Apple Silicon）
2. 打开 DMG 并将应用拖入「应用程序」。后续更新同样自动（`latest-mac.yml`）。
3. ⚠️ DMG **尚未经 Apple 公证**：首次打开时 macOS 会要求「系统设置 → 隐私与安全性 → 仍要打开」。

### 浏览器（PWA）
- 用任意 Web 服务器托管静态构建（`dist/`）；也可直接打开本地 `index.html`。
- 可从 Chrome/Edge "安装 ShopLogic Pro"。

### 首次启动
应用加载演示数据（手机、客户、维修、发票…）及以下用户：

| 邮箱 | 密码 | 角色 |
|---|---|---|
| `admin@shoplogic.com` | `admin123` | 管理员（全部） |
| `manager@shoplogic.com` | `manager123` | 经理 |
| `tecnico@shoplogic.com` | `tecnico123` | 技师 |
| `cajero@shoplogic.com` | `cajero123` | 收银员 |

> ⚠️ **在生产环境使用前，请修改这些密码或删除这些用户**（用户 → 编辑）。

---

## 🛠️ 开发

```bash
npm install          # 依赖
npm run dev          # Vite 开发服务器（浏览器中 PWA）
npm run start        # 将构建产物应用到本地 Electron
npm run build        # 生产构建（tsc + vite）
npm run dist         # 用 electron-builder 打包 Windows x64 + arm64
npm test             # 单元测试（vitest）
npm run lint         # oxlint
npm run check:i18n   # 校验 5 个语言文件词条一致
```

### macOS 构建（DMG）

```bash
npm run build                   # web 构建到 dist/
npx electron-builder --mac --x64 --arm64   # DMG x64 + arm64 输出到 release/
```

### Android 构建（Capacitor）

需要 JDK 21（系统 Java 25 仍与 AGP 不兼容），将 web 构建包装为原生壳：

```bash
npm run build                    # web 构建到 dist/
npx cap sync android             # 复制 dist/ 和插件到 Android 工程
export JAVA_HOME="$USERPROFILE/.jdks/jbr-21.0.11"     # JDK 21
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"       # Android SDK
export SL_KEYSTORE="$USERPROFILE/.android/shoplogic-release.jks"  # 仓库外的 keystore
export SL_KEYSTORE_PASS=…; export SL_KEY_ALIAS=shoplogic; export SL_KEY_PASS=…
cd android && ./gradlew assembleRelease      # 签名后的 APK 位于 app/build/outputs/apk/release/
```

### 技术栈
- **前端**：React 19 + TypeScript + Tailwind CSS 4 + Zustand。
- **数据**：Dexie（IndexedDB）原子事务；类型模型在 `src/types`。
- **桌面**：Electron 44 + electron-updater，配合 GitHub Releases。
- **财税**：`src/verifactu/` 模块（AEAT 指纹、链式、XML、SOAP、队列、QR）+ 主进程内 XAdES 签名（`xml-crypto` + `node-forge`）。
- **移动**：Capacitor 8（`capacitor.config.ts` + `android/` 工程），APK 通过环境变量读取 keystore 签名。
- **i18n**：i18next + react-i18next，5 个类型化资源在 `src/i18n`（es · en · pt · zh · ar 含 RTL）。
- **测试**：Vitest + fake-indexeddb（155 个测试），含备份、凭据、AEAT 指纹、XAdES 签名、更正发票和二手收购测试。

### 目录结构
```
src/
├── components/    # 25+ UI 模块（POS, Cash, Inventory, Repairs, Quotes, Billing, Reports, TradeIns…）
├── verifactu/     # Veri*factu 财税模块：指纹、链式、XML、SOAP、队列、QR（含测试）
├── lib/           # 核心逻辑：calc, stock, invoices, cash, messaging, backup, csv, update, tradein…
├── db/            # Dexie 模式 + 演示数据
├── i18n/          # es, en, pt, zh, ar（1,016 个同步词条）
├── schemas/       # 所有表单的 Zod 校验
└── types/         # 类型化领域模型
electron/          # 主进程、preload、updater 和 XAdES 签名器
android/           # 原生 Android 工程（Capacitor，Gradle 签名构建）
server/            # 本地 SMTP relay（127.0.0.1），用于邮件发送
public/            # service worker + manifest
```

---

## 📋 新版本 / 更新日志（v1.3.4）

### 🛍️ 二手收购（trade-in）
- 模块更名为 **「二手收购」**（5 种语言的导航），用于二手设备的估价、收购和补货。
- 估价含成本 + 毛利，登记采购后**直接入库**（含 IMEI）。
- **全程溯源**：每笔收购按 `trade_in` 流水记入商品台账，含来源与支付价格。

### 🧾 R1–R5 更正发票
- 从开票模块开具**差额法更正发票**，部分/全额退货时**自动检测并生成**更正发票，链式加入 Veri*factu 并引用原发票。

### 📈 财务报表
- 报表模块内置 **303 表格（季度增值税）** 与 **347 表格（第三方交易）**，可直接导出 **PDF 和 CSV** 用于申报。

### 🔐 安全加固
- Veri*factu 证书 `.p12` 密码改为用 **safeStorage 加密存储**（DPAPI/钥匙串）而非明文。
- 本地 **SMTP relay** 仅监听 `127.0.0.1` 并校验 `Origin` 头。
- **登录连续失败临时锁定**（退避 `30 秒·2ⁿ`）。
- **可选 AES-256-GCM 加密备份**（PBKDF2 310k），设置页内置加密/解密界面。

### 🎨 全新视觉形象
- 新企业 logo 应用于 Electron (ico/icns)、PWA、Android（mipmap + 启动图）和 GitHub 社交预览图。

### 多平台打包
- NSIS Windows **x64 和 ARM64** 安装包 + **macOS DMG x64/arm64** + **Android APK**（versionCode 134），桌面自动更新走 `latest.yml` / `latest-mac.yml`。

---

## 🗺️ 版本历史

| 版本 | 主要更新 |
|---|---|
| **v1.3.4**（Windows x64/ARM64 + macOS x64/ARM64 + Android） | **二手收购**（入库带溯源）· **R1–R5 更正发票**并自动检测退货 · **303/347 财务报表** · 安全加固（safeStorage、localhost SMTP、登录锁定、AES-256-GCM 备份） · 全平台新 logo |
| **v1.3.3**（Windows） | **维修小票打印**：创建时可选择 + 模态预览 · 小票头自动同步真实店名 |
| **v1.3.2**（Windows x64 + ARM64） | **VERI*FACTU Companion**：主进程内保护的 `.p12` 证书向导 · AEAT 队列诊断 + 连接测试 · 异常中心含 XML 查看器 · 可导出责任声明 · x64/ARM64 多架构打包 |
| **v1.3.0**（Windows） | **完整 Veri\*factu（RD 1007/2023）**：官方 SHA-256 指纹带 AEAT 向量 · 链式登记 · XML/SOAP SuministroLR · 持久化队列带重试 · PDF 法定 QR · 异常界面显示 AEAT 错误 · 本地 `.p12` **XAdES 签名器** |
| **v1.2.0**（Windows + Android） | **Ctrl+K 全局搜索** · **定时外部备份** · **Veri\*factu（西班牙）**SHA-256 链式指纹 · 大型目录 Dexie 索引 · 发布 CI 工作流 |
| **v1.1.0**（Windows） | 登录改为用户选择 + 密码 · 移除演示提示 |
| **v1.0.6** | 维修阶段通知（已接收/处理中/等待配件）通过 WhatsApp + 邮件 · 图标重新生成 |
| **v1.0.5** | 新企业图标（手机 + 扳手 + 图表）应用于安装器、窗口和 PWA |
| **v1.0.4** | 一键安装器（单次 UAC 自动更新）· 完整 README |
| **v1.0.3** | 报价可转换为销售/维修 · POS 组合支付 · F1-F4 快捷键 · 按表 CSV · 备份中凭据遮蔽 · PWA 真离线 |
| **v1.0.2** | 版本号显示在侧边栏 · 非强制更新横幅 |
| **v1.0.1** | 通过 GitHub Releases + electron-updater 实现自动更新 |

## 📄 许可
私有项目。保留所有权利。
