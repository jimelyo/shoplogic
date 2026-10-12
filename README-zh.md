# 📱 ShopLogic Pro

<p align="center">
  <img src="public/icon-512.png" width="128" alt="ShopLogic Pro">
</p>

> 🌍 **语言 / Languages**: [Español](README.md) · [English](README-en.md) · [Português](README-pt.md) · [العربية](README-ar.md)

**面向手机及配件商店的全功能 ERP + 收银系统** — 销售收银、库存溯源、维修工单、开票、报表和消息自动化。完全本地运行（数据绝不离开您的设备），并从 GitHub Releases 自动更新。

[![Release](https://img.shields.io/github/v/release/jimelyo/shoplogic)](https://github.com/jimelyo/shoplogic/releases/latest)
[![平台](https://img.shields.io/badge/Windows-x64%20%7C%20arm64-blue)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Android](https://img.shields.io/badge/Android-APK%20v1.2.0-green)](https://github.com/jimelyo/shoplogic/releases/tag/v1.2.0)
[![语言](https://img.shields.io/badge/语言-5%20·%20阿拉伯语%20RTL-purple)](#-语言)
[![许可](https://img.shields.io/badge/使用-私人-informational)]()

---

## ✨ 功能

### 🌍 语言

应用**完整翻译为 5 种语言**（每种约 872 个词条，由 `npm run check:i18n` 校验一致），可在登录界面和侧边栏切换：

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
- **按商品的流水记录**（ledger）：销售、采购、调整和退货，含前后余额。
- 分类可自定义图标和颜色。
- 摄像头扫码查询商品。

### 🔧 维修车间
- 工单 `R-000001`，含客户、设备、IMEI、故障、诊断和状态流转（已接收 → 诊断 → 处理中 → 等待配件 → 已完成 → 已交付）。
- 完成时通过 WhatsApp/邮件自动通知客户（可自动化），附可打印回执。
- **按 IMEI 的历史**页面，保修可配置。
- 交付时自动开票（可选）。

### 💶 钱箱
- 班次开/关，含备用金、入金和取款。
- 应收与实收盘点并计算差额，按现金销售、发票和退货分别结算。

### 🧾 发票
- 编号可配置（顺序、按日期、按年份或自定义格式），系列和前缀。
- 状态（草稿、已发送、已支付、部分、逾期、已取消），支持部分收款。
- **专业 PDF** 带水印、标准联数和销售小票。

### 👥 客户、供应商与采购
- 客户 360° 档案：累计消费、到店次数、积分、按 IMEI 的设备历史。
- 供应商含联系方式，采购单支持**部分收货**。
- **补货助手**：一键生成包含所有低于最低库存商品的采购草稿。

### 📈 报表
- 销售、利润、毛利、按分类销售、按状态维修。
- 财务汇总（收入、支出、结余）及任何报表的 **PDF 导出**。

### 🤖 自动化与消息
- **维修阶段通知**：工单每次状态变更可自动通知客户：
  - 📥 已接收 → WhatsApp
  - 🛠️ 处理中 → WhatsApp + 邮件
  - ⏰ 等待配件 → WhatsApp + 邮件
  - ✅ 已就绪 / 已完成 → WhatsApp + 邮件（含最终费用摘要）
- 其他可配置自动化：销售收据 WhatsApp 发送、日报、每日备份、库存告警、逾期发票…
- **WhatsApp** 两种模式：`wa.me` 直链（无需服务器）或官方 **Cloud API**。
- **邮件**支持 Gmail/Outlook/通用 SMTP 预设。
- 发送队列（outbox），重启时若中继不可用则自动重试。
- 所有使用记录在审计日志（谁在何时发送了什么）。

### ⚙️ 设置与数据
- 多币种（EUR、USD、GBP、MXN、ARS、COP、CLP、BRL、CNY、MAD），税率可配置。自有品牌：应用名称、logo、商店税务信息显示在小票/PDF。
- 明暗主题 + 6 种强调色。
- 空闲锁定屏幕，需密码解锁。
- 基于角色的 RBAC：**管理员、经理、技师、收银员**，权限矩阵可按模块逐项编辑。
- 数据管理：完整 JSON 导出/导入、**按表的 CSV 导出（Excel）**、选择性重置并自动先备份。
- 审计：所有操作（登录、销售、修改、发送、打印）记录用户和时间。

### 🔄 自动更新
- **桌面端（Electron）**：启动时及每 30 分钟查询 GitHub Releases；后台下载并支持**差量下载**（blockmaps）、可见进度和按版本可关闭的横幅；关闭应用时安装，只需**一次 UAC**（一键安装器，无向导）。
- **PWA（浏览器）**：service worker 检测新版本并在刷新时应用（可在 外观 → 更新 中开启自动）。
- **真正的离线**：service worker 预缓存所有资源 — 首次访问后即可无网络运行。

---

## 🔐 安全与隐私

- **100% 本地**：数据库存放在浏览器的 IndexedDB。不向任何服务器发送数据（WhatsApp/邮件直接从您的机器或您自己的中继发出）。
- 密码采用 **PBKDF2-SHA256（210,000 次迭代）** + 每用户随机盐，常量时间比较，并自动升级旧哈希。
- 消息**凭据在磁盘每日快照中遮蔽显示**；完整手动备份仅在您明确要求时包含它们，UI 中有提示。
- 导入的备份在恢复前**逐行校验**。
- Electron 启用 `contextIsolation` + 沙箱，渲染进程不集成 Node。

---

## 🚀 安装

### 📱 Android
1. 从 [Release v1.2.0](https://github.com/jimelyo/shoplogic/releases/tag/v1.2.0) 下载 **`shoplogic-pro-v1.2.0-android.apk`**（与 v1.1.0 同签名密钥：直接覆盖安装）。
2. 首次安装时，允许浏览器/文件管理器**安装未知来源应用**（设置 → 安全）。
3. 打开 APK 安装。需要 **Android 6.0+（API 23+）**。除网络外无其他权限：数据保存在应用内的 IndexedDB，完全本地。

### Windows（推荐 — 桌面）
1. 从 [Releases](https://github.com/jimelyo/shoplogic/releases/latest) 下载适合您架构的安装包：
   - `ShopLogic-Setup-x.y.z-x64.exe`（Windows 10/11 x64）
   - `ShopLogic-Setup-x.y.z-arm64.exe`（Windows on ARM）
2. 运行安装包（静默安装，仅一次 UAC）。快捷方式位于桌面。
3. 此后更新自动下载并应用。

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
- **移动**：Capacitor 8（`capacitor.config.ts` + `android/` 工程），APK 通过环境变量读取 keystore 签名。
- **i18n**：i18next + react-i18next，5 个类型化资源在 `src/i18n`（es · en · pt · zh · ar 含 RTL）。
- **测试**：Vitest + fake-indexeddb（78 个测试），含备份和凭据测试。

### 目录结构
```
src/
├── components/    # 25+ UI 模块（POS, Cash, Inventory, Repairs, Quotes, Billing, Reports…）
├── lib/           # 核心逻辑：calc, stock, invoices, cash, messaging, backup, csv, update…
├── db/            # Dexie 模式 + 演示数据
├── i18n/          # es, en, pt, zh, ar（872 个同步词条）
├── schemas/       # 所有表单的 Zod 校验
└── types/         # 类型化领域模型
electron/          # 主进程、preload 和 updater
android/           # 原生 Android 工程（Capacitor，Gradle 签名构建）
public/            # service worker + manifest
```

---

## 🗺️ 版本历史

| 版本 | 主要更新 |
|---|---|
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
