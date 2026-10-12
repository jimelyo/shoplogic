# 📱 ShopLogic Pro

<p align="center">
  <img src="public/icon-512.png" width="128" alt="ShopLogic Pro">
</p>

> 🌍 **Idiomas / Languages**: [Español](README.md) · [English](README-en.md) · [中文](README-zh.md) · [العربية](README-ar.md)

**ERP + TPV completo para lojas de telemóveis e acessórios** — vendas, caixas, inventário com rastreabilidade, oficina de reparações, faturação, relatórios e automatizações de mensagens. Funciona 100% local (os seus dados nunca saem do equipamento) e atualiza-se sozinho a partir do GitHub Releases.

[![Release](https://img.shields.io/github/v/release/jimelyo/shoplogic)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Plataforma](https://img.shields.io/badge/Windows-x64%20%7C%20arm64-blue)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Android](https://img.shields.io/badge/Android-APK%20v1.1.0-green)](https://github.com/jimelyo/shoplogic/releases/tag/v1.1.0-android)
[![Idiomas](https://img.shields.io/badge/idiomas-5%20·%20RTL%20árabe-purple)](#-idiomas)
[![Licença](https://img.shields.io/badge/uso-privado-informational)]()

---

## ✨ Funcionalidades

### 🌍 Idiomas

A app está **100% traduzida em 5 idiomas** (~872 chaves sincronizadas, verificadas por `npm run check:i18n`), selecionáveis no ecrã de login e no menu lateral:

| Código | Idioma | Bandeira | RTL |
|---|---|---|---|
| `es` | Espanhol (predefinido) | 🇪🇸 | — |
| `en` | Inglês | 🇬🇧 | — |
| `pt` | Português | 🇵🇹 | — |
| `zh` | Chinês | 🇨🇳 | — |
| `ar` | Árabe | 🇸🇦 | ✓ **RTL completo** |

- O idioma é guardado no `localStorage` (`sl_lang`) e persiste entre sessões; o árabe muda a direção da página (`dir=rtl`) e todos os estilos adaptam-se com as utilidades lógicas do Tailwind (`ms-`, `me-`, `start-`, `end-`).
- Talões, PDFs de faturas e mensagens automáticas de WhatsApp/email também respeitam o idioma ativo.
- Fallback automático para espanhol se faltar uma chave.

### 🛒 Ponto de Venda (TPV)
- Cobrança com **um toque** a partir de cartões de produto ou tabela, com catálogo filtrado por categorias.
- **Pagamentos divididos**: cobre uma venda com vários meios ao mesmo tempo (ex.: 20 € em dinheiro + resto em cartão), repartição validada antes de cobrar e refletida no talão.
- Descontos por % ou valor fixo, IVA incluído com desglose no ecrã.
- **Leitor de códigos**: por leitor USB (escreve na pesquisa) ou com a **câmara** (códigos EAN/UPC/Code128/QR e IMEI) através da API nativa `BarcodeDetector`.
- **Atalhos de teclado**: `F1` pesquisar · `F2` cobrar · `F3` digitalizar · `F4` esvaziar carrinho.
- Pontos de fidelidade automáticos por valor de compra.
- Talão imprimível (58/80 mm) com logótipo e envio de recibo por **WhatsApp ou email**.

### 📋 Orçamentos
- Cria um orçamento de **venda ou reparação** com linhas, validade e notas.
- Fluxo: rascunho → enviado → aceite → **converter com um clique**:
  - → **Venda** (desconta stock numa transação atómica)
  - → **Reparação** (cria o ticket pré-preenchido com dispositivo/IMEI/problema/custo)
- Caducidade automática e orçamento imprimível em estilo talão.

### 📦 Inventário e movimentos
- Produtos com código de barras, IMEI, custo, PVP (IVA incl.), stock mínimo e margens calculadas.
- Alertas de stock baixo/esgotado com notificações automáticas.
- **Histórico de movimentos por produto** (ledger): vendas, compras, ajustes e devoluções com saldo anterior/posterior.
- Categorias personalizáveis com ícone e cor.
- Leitor de câmara para pesquisar produtos.

### 🔧 Oficina de reparações
- Tickets `R-000001` com cliente, dispositivo, IMEI, problema, diagnóstico e evolução de estados (recebido → diagnóstico → em curso → à espera de peças → concluído → entregue).
- Aviso ao cliente por WhatsApp/email ao concluir (automatizável), com comprovativo imprimível.
- Ficha de **histórico por IMEI** com garantia configurável.
- Faturação automática ao entregar (opcional).

### 💶 Caixa
- Abertura/fecho de turnos com fundo inicial, depósitos e retiradas.
- Arrecadação esperado vs contado com diferença calculada, corte por venda (dinheiro), faturas e devoluções.

### 🧾 Faturação
- Numeração configurável (sequencial, por data, por ano ou formato personalizado), série e prefixos.
- Estados (rascunho, enviada, paga, parcial, vencida, cancelada) com cobranças parciais.
- **PDF profissional** com marca de água, cópias normalizadas e talão de vendas.

### 👥 Clientes, fornecedores e compras
- Ficha 360° do cliente: gasto total, visitas, pontos, histórico de dispositivos por IMEI.
- Fornecedores com contactos e encomendas de compra com **receção parcial**.
- **Reposição assistida**: gera um rascunho de encomenda com todos os produtos abaixo do stock mínimo num clique.

### 📈 Relatórios
- Vendas, lucro, margem, vendas por categoria, reparações por estado.
- Resumo financeiro (receitas, despesas, balanço) e exportação **PDF de qualquer relatório**.

### 🤖 Automatizações e mensagens
- **Avisos por etapa da oficina**: cada mudança de estado de uma reparação pode notificar o cliente automaticamente:
  - 📥 Recebido → WhatsApp
  - 🛠️ Em curso → WhatsApp + Email
  - ⏰ À espera de peças → WhatsApp + Email
  - ✅ Pronta / Concluída → WhatsApp + Email (resumo com custo final)
- Automatizações configuráveis adicionais: recibos de venda por WhatsApp, resumo diário, backup diário, alertas de stock e faturas vencidas…
- **WhatsApp** em dois modos: link direto `wa.me` (sem servidor) ou **Cloud API** oficial.
- **Email** com presets Gmail/Outlook/SMTP genérico.
- Fila de envio (outbox) com repetições ao reiniciar se o servidor relay não estava disponível.
- Todo o uso fica registado na auditoria (quem enviou o quê e quando).

### ⚙️ Configuração e dados
- Múltiplas moedas (EUR, USD, GBP, MXN, ARS, COP, CLP, BRL, CNY, MAD), IVA configurável. Marca própria: nome da app, logótipo, dados fiscais da loja em talões/PDF.
- Tema claro/escuro + 6 cores de destaque.
- Bloqueio de ecrã por inatividade com palavra-passe.
- RBAC por perfis: **admin, manager, técnico, caixa**, com matriz de permissões editável módulo a módulo.
- Gestão de dados: export/import JSON completo, **exportação CSV por tabela (Excel)**, reset seletivo com backup prévio automático.
- Auditoria: registo de ações (login, vendas, modificações, envios, impressões) com utilizador e data.

### 🔄 Autoatualizações
- **Desktop (Electron)**: consulta GitHub Releases ao arrancar e a cada 30 min; transferência em segundo plano com **transferência diferencial** (blockmaps), progresso visível e banner dispensável por versão; a instalação aplica-se ao fechar a app com **um único UAC** (instalador one-click, sem assistente).
- **PWA (navegador)**: o service worker deteta a nova versão e aplica-a ao recarregar (automático se o ativar em Aparência → Atualização).
- **Offline real**: o service worker faz precache de todos os assets — funciona sem ligação desde a primeira visita.

---

## 🔐 Segurança e privacidade

- **100% local**: a base de dados vive no IndexedDB do seu navegador/equipamento. Nada é enviado para servidores (os envios de WhatsApp/email saem diretamente da sua máquina ou do seu próprio relay).
- Palavras-passe com **PBKDF2-SHA256 (210.000 iterações)** + salt aleatório por utilizador, comparação em tempo constante e upgrade automático de hashes antigos.
- As **credenciais de mensagens ficam mascaradas** no snapshot diário em disco; o backup manual completo inclui-as apenas se o pedir, com aviso na UI.
- Os backups importados são **validados linha a linha** antes de restaurar.
- Electron com `contextIsolation` + sandbox e sem integração de Node no renderer.

---

## 🚀 Instalação

### 📱 Android
1. Transfira **`shoplogic-pro-v1.1.0-android.apk`** a partir de [Release v1.1.0-android](https://github.com/jimelyo/shoplogic/releases/tag/v1.1.0-android).
2. Permita **instalar apps de fontes desconhecidas** para o seu navegador/gestor de ficheiros (Definições → Segurança) na primeira vez.
3. Abra o APK e instale-a. Requer **Android 6.0+ (API 23+)**. Sem permissões para além de internet: os dados vivem no IndexedDB dentro da app, 100% locais.

### Windows (recomendado — desktop)
1. Transfira o instalador para a sua arquitetura a partir de [Releases](https://github.com/jimelyo/shoplogic/releases/latest):
   - `ShopLogic-Setup-x.y.z-x64.exe` (Windows 10/11 x64)
   - `ShopLogic-Setup-x.y.z-arm64.exe` (Windows on ARM)
2. Execute o instalador (instalação silenciosa com um único UAC). O atalho fica no ambiente de trabalho.
3. As atualizações passam a ser transferidas e aplicadas **automaticamente**.

### Navegador (PWA)
- Sirva a build estática (`dist/`) com qualquer servidor web; também funciona abrindo o `index.html` local.
- Instalável como app a partir do Chrome/Edge ("Install ShopLogic Pro").

### Primeiro arranque
A app carrega dados de demonstração (telemóveis, clientes, reparações, faturas…) e estes utilizadores:

| Email | Palavra-passe | Perfil |
|---|---|---|
| `admin@shoplogic.com` | `admin123` | Administrador (tudo) |
| `manager@shoplogic.com` | `manager123` | Manager |
| `tecnico@shoplogic.com` | `tecnico123` | Técnico |
| `cajero@shoplogic.com` | `cajero123` | Caixa |

> ⚠️ **Mude essas palavras-passe ou elimine esses utilizadores antes de usar a app em produção** (Utilizadores → editar).

---

## 🛠️ Desenvolvimento

```bash
npm install          # dependências
npm run dev          # Vite dev server (PWA no navegador)
npm run start        # aplica a build ao Electron local
npm run build        # build de produção (tsc + vite)
npm run dist         # empacota Windows x64 + arm64 com electron-builder
npm test             # testes unitários (vitest)
npm run lint         # oxlint
npm run check:i18n   # verifica 5 locales com chaves idênticas
```

### Build Android (Capacitor)

Requer um JDK 21 (o Java 25 do sistema ainda é incompatível com o AGP) e envolve a build web numa shell nativa:

```bash
npm run build                    # build web para dist/
npx cap sync android             # copia dist/ + plugins para o projeto Android
export JAVA_HOME="$USERPROFILE/.jdks/jbr-21.0.11"     # JDK 21
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"       # Android SDK
export SL_KEYSTORE="$USERPROFILE/.android/shoplogic-release.jks"  # keystore fora do repo
export SL_KEYSTORE_PASS=…; export SL_KEY_ALIAS=shoplogic; export SL_KEY_PASS=…
cd android && ./gradlew assembleRelease      # APK assinada em app/build/outputs/apk/release/
```

### Stack
- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + Zustand.
- **Dados**: Dexie (IndexedDB) com transações atómicas; modelos tipados em `src/types`.
- **Desktop**: Electron 44 + electron-updater com Releases de GitHub.
- **Móvel**: Capacitor 8 (`capacitor.config.ts` + projeto `android/`), APK assinada com keystore via variáveis de ambiente.
- **i18n**: i18next + react-i18next, 5 recursos tipados em `src/i18n` (es · en · pt · zh · ar com RTL).
- **Testes**: Vitest + fake-indexeddb (78 testes), incluindo testes de backups e credenciais.

### Estrutura
```
src/
├── components/    # 25+ módulos UI (POS, Cash, Inventory, Repairs, Quotes, Billing, Reports…)
├── lib/           # lógica core: calc, stock, invoices, cash, messaging, backup, csv, update…
├── db/            # esquema Dexie + dados demo
├── i18n/          # es, en, pt, zh, ar (872 chaves sincronizadas)
├── schemas/       # validação Zod de todos os formulários
└── types/         # modelos tipados do domínio
electron/          # processo principal, preload e updater
android/           # projeto Android nativo (Capacitor, build Gradle assinada)
public/            # service worker + manifest
```

---

## 🗺️ Histórico de releases

| Versão | Novidades principais |
|---|---|
| **v1.1.0** (Windows) | Login por seleção de utilizador + palavra-passe · aviso demo eliminado · Latest atual |
| **v1.1.0-android** | Primeira build Android nativa (Capacitor 8, APK assinada, API 23+) |
| **v1.0.6** | Avisos por etapa da oficina (recebido/em curso/à espera de peças) em WhatsApp + email · ícone regenerado |
| **v1.0.5** | Novo ícone corporativo (telemóvel + chave + gráfico) no instalador, janela e PWA |
| **v1.0.4** | Instalador one-click (auto-update com um único UAC) · README completo |
| **v1.0.3** | Orçamentos convertíveis em venda/reparação · pagamentos divididos no TPV · atalhos F1-F4 · CSV por tabela · credenciais mascaradas em backups · PWA offline real |
| **v1.0.2** | Versão visível no sidebar · banner de atualização não forçada |
| **v1.0.1** | Auto-update via GitHub Releases com electron-updater |

## 📄 Licença
Projeto privado. Todos os direitos reservados.
