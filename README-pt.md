# 📱 ShopLogic Pro v1.3.4

<p align="center">
  <img src="public/icon-512.png" width="128" alt="ShopLogic Pro">
</p>

> 🌍 **Idiomas / Languages / 语言 / اللغات**: [Español](README.md) · [English](README-en.md) · [中文](README-zh.md) · [العربية](README-ar.md)

**ERP + TPV completo para lojas de telemóveis e acessórios** — vendas, caixas, inventário com rastreabilidade, oficina de reparações, faturação com Veri*factu, relatórios fiscais 303/347, compras de segunda mão e automatizações de mensagens. Funciona 100% local (os seus dados nunca saem do equipamento) e atualiza-se sozinho a partir do GitHub Releases.

[![Release](https://img.shields.io/github/v/release/jimelyo/shoplogic)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Plataforma](https://img.shields.io/badge/Windows-x64%20%7C%20arm64-blue)](https://github.com/jimelyo/shoplogic/releases/latest)
[![macOS](https://img.shields.io/badge/macOS-DMG%20x64%20%7C%20arm64-lightgrey)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Android](https://img.shields.io/badge/Android-APK%20v1.3.4-green)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Idiomas](https://img.shields.io/badge/idiomas-5%20·%20RTL%20árabe-purple)](#-idiomas)
[![Licença](https://img.shields.io/badge/uso-privado-informational)]()

---

## ✨ Funcionalidades

### 🛒 Ponto de Venda (TPV)
- Cobrança com **um toque** a partir de cartões de produto ou tabela, com catálogo filtrado por categorias.
- **Pagamentos divididos**: cobre uma venda com vários meios ao mesmo tempo (ex.: 20 € em dinheiro + resto em cartão), repartição validada antes de cobrar e refletida no talão.
- Descontos por % ou valor fixo, IVA incluído com decomposição no ecrã.
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
- **Histórico de movimentos por produto** (ledger): vendas, compras, ajustes, devoluções e compras de segunda mão com saldo anterior/posterior.
- Categorias personalizáveis com ícone e cor.
- Leitor de câmara para pesquisar produtos.

### 🔧 Oficina de reparações
- Tickets `R-000001` com cliente, dispositivo, IMEI, problema, diagnóstico e evolução de estados (recebido → diagnóstico → em curso → à espera de peças → concluído → entregue).
- **Impressão do talão de entrada** ao registar a reparação (opcional logo no diálogo de criação, pensado para quando o cliente ainda está no balcão) com **pré-visualização** antes de imprimir.
- Aviso ao cliente por WhatsApp/email ao concluir (automatizável), com resguardo imprimível.
- Ficha de **histórico por IMEI** com garantia configurável.
- Faturação automática ao entregar (opcional).

### 💶 Caixa
- Abertura/fecho de turnos com fundo inicial, depósitos e retiradas.
- Arqueo esperado vs contado com diferença calculada, corte por venda (dinheiro), faturas e devoluções.

### 🧾 Faturação e retificativas
- Numeração configurável (sequencial, por data, por ano ou formato personalizado), série e prefixos.
- Estados (rascunho, enviada, paga, parcial, vencida, cancelada) com cobranças parciais.
- **PDF profissional** com marca de água, cópias normalizadas e talão de vendas.
- **QR regulamentar** no PDF: URL oficial de cotejo da AEAT (35 mm, nível M) + legenda oficial «Fatura verificável na sede eletrónica da AEAT».
- **Retificativas R1–R5 (por diferenças)**: emite faturas retificativas a partir da Faturação e gera **automaticamente** a retificativa de uma devolução parcial ou total, com enfileiramento Veri*factu em cadeia.

### 🛍️ Compras de segunda mão (trade-in)
- Módulo dedicado para **avaliar, comprar e reabastecer** terminais e acessórios de segunda mão, direto no menu principal.
- Avaliação com decomposição (custo + margem alvo), registo da compra ao fornecedor/particular e **alta direta no inventário** com o respetivo IMEI.
- Rastreabilidade total do stock: cada compra é registada como movimento `trade_in` no ledger do produto, com origem (particular) e preço pago.
- Integrado com o TPV: o artigo comprado pode ser vendido como qualquer outro produto.

### 📈 Reports / relatórios fiscais
- Vendas, lucro, margem, vendas por categoria, reparações por estado.
- **Modelo 303 (IVA trimestral)**: liquidação por trimestres com IVA liquidado e IVA suportado dedutível, exportação **PDF/CSV**.
- **Modelo 347**: declaração anual de operações com terceiros (operações > 3.005 € por cliente/fornecedor), exportação **PDF/CSV**.
- Resumo financeiro (receitas, despesas, saldo) e exportação **PDF de qualquer relatório**.

### 🇪🇸 Veri*factu — Espanha (RD 1007/2023 · Ordem HAC/1177/2024)
Módulo fiscal completo conforme os documentos técnicos oficiais da AEAT:
- **Pegada SHA-256 oficial**: cadeia `campo=valor&…` com a ordem exata do documento AEAT v0.1.2, UTF-8 e hex MAIÚSCULAS. Reproduz os **3 vetores de teste oficiais** (alta inicial, alta encadeada e anulação encadeada).
- **Encadeamento registo a registo** (`chainAlta`/`chainAnulacion`) com sensibilidade integral a qualquer campo modificado.
- **XML** de `RegistroAlta`/`RegistroAnulacion`/lote (≤ 1000 registos) segundo os esquemas `SuministroLR.xsd`/`SuministroInformacion.xsd`, validado contra o exemplo oficial do doc. v1.0.3. As **retificativas** (R1–R5) encadeiam com a sua referência à fatura original.
- **SOAP** para os endpoints WSDL oficiais (pré-produção `prewww1.aeat.es` / produção `www1.agenciatributaria.gob.es`) com parser de `RespuestaSuministro` (`Correcto` / `AceptadoConErrores` / `Incorrecto`) e detalhe de erros por registo.
- **Fila persistente e recuperável** após reinício: estados `PERSISTED → QUEUED → SENDING → ACCEPTED / ACCEPTED_WITH_ERRORS / REJECTED / RETRY_PENDING` com backoff 15 s → 1 min → 10 min → 1 h. A fatura é persistida **sempre** (padrão outbox): se a emissão fiscal falhar não se perde nem se duplica.
- **Assinatura XAdES-Enveloped** (ETSI EN 319 132) com xml-crypto + node-forge no processo main do Electron, carregando um certificado `.p12/.pfx` local. A chave privada nunca sai do processo main.
- **Companion**, ecrã de incidências, painel de estado e declaração responsável do produtor do SIF (ver histórico v1.3.2).
- **QR de cotejo AEAT** no PDF de cada fatura.

### 🤖 Automatizações e mensagens
- **Avisos por etapa da oficina**: cada mudança de estado de uma reparação pode notificar o cliente automaticamente:
  - 📥 Recebido → WhatsApp
  - 🛠️ Em curso → WhatsApp + Email
  - ⏰ À espera de peças → WhatsApp + Email
  - ✅ Pronta / Concluída → WhatsApp + Email (resumo com custo final)
- Automatizações configuráveis adicionais: recibos de venda por WhatsApp, resumo diário, backup diário, alertas de stock e faturas vencidas…
- **WhatsApp** em dois modos: ligação direta `wa.me` (sem servidor) ou **Cloud API** oficial.
- **Email** com presets Gmail/Outlook/SMTP genérico. O **relay SMTP local** escuta apenas em `127.0.0.1` e valida o cabeçalho `Origin` de cada envio.
- Fila de envio (outbox) com repetição automática ao reiniciar se o servidor relay não estava disponível.
- Todo o uso fica registado na auditoria (quem enviou o quê e quando).

### ⚙️ Configuração e dados
- **Backup programado** + **backups encriptados opcionais AES-256-GCM** (chave derivada com PBKDF2-SHA256, 310.000 iterações) com UI de encriptação/desencriptação nas Definições.
- Múltiplas moedas (EUR, USD, GBP, MXN, ARS, COP, CLP, BRL, CNY, MAD), IVA configurável. Marca própria: nome da app, logótipo, dados fiscais da loja em talões/PDF.
- Tema claro/escuro + 6 cores de acento.
- Bloqueio de ecrã por inatividade com palavra-passe.
- RBAC por perfis: **admin, gestor, técnico, caixa**, com matriz de permissões editável módulo a módulo.
- Gestão de dados: export/import JSON completo, **exportação CSV por tabela (Excel)**, reset seletivo com backup prévio automático.
- Auditoria: registo de ações (logins, vendas, modificações, envios, impressões) com utilizador e data.

### 🌍 Idiomas

A app está **100% traduzida em 5 idiomas** (≈ 1.016 chaves sincronizadas, verificadas por `npm run check:i18n`), selecionáveis no ecrã de login e no menu lateral:

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

### 🔄 Atualizações automáticas
- **Desktop (Electron)**: consulta GitHub Releases ao arrancar e a cada 30 min; descarregamento em segundo plano com **descarregamento diferencial** (blockmaps), progresso visível e banner dispensável por versão; a instalação aplica-se ao fechar a app com **um só UAC** (instalador one-click, sem assistente).
- **PWA (navegador)**: o service worker deteta a nova versão e aplica-a ao recarregar (automático se o ativar em Aparência → Atualização).
- **Offline real**: o service worker pré-armazena todos os assets — funciona sem ligação desde a primeira visita.

---

## 🔐 Segurança e privacidade

- **100% local**: a base de dados vive no IndexedDB do seu navegador/equipamento. Nada é enviado para nenhum servidor (os envios de WhatsApp/email saem diretamente da sua máquina ou do seu próprio relay).
- Palavras-passe com **PBKDF2-SHA256 (210.000 iterações)** + salt aleatório por utilizador, comparação em tempo constante e upgrade automático de hashes antigos.
- **Bloqueio temporário do login** após falhas repetidas (atraso exponencial `30 s·2ⁿ`): trava ataques de força bruta offline sem bloquear o utilizador legítimo.
- As **credenciais de mensagens ficam mascaradas** no snapshot diário em disco; o backup manual completo inclui-as só se o pedir, com aviso na UI.
- **A palavra-passe do certificado `.p12` é encriptada com safeStorage** (DPAPI no Windows / Keychain no macOS) e nunca é guardada em claro.
- **Backups encriptados AES-256-GCM** opcionais (PBKDF2 310k) — se definir uma palavra-passe para o backup, o ficheiro exportado fica ilegível sem ela.
- **Veri*factu**: o `.p12` do certificado AEAT é lido apenas no processo main do Electron; a chave privada nunca chega ao renderer nem viaja pela rede. Sem assinador configurado a fila fica em `RETRY_PENDING` (nunca finge aceitação).
- O **relay SMTP** local só aceita ligações de `127.0.0.1` e rejeita pedidos com `Origin` externo.
- Os backups importados são **validados linha a linha** antes de restaurar.
- Electron com `contextIsolation` + sandbox e sem integração de Node no renderer.

---

## 🚀 Instalação

### 📱 Android
1. Descarregue **`shoplogic-pro-v1.3.4-android.apk`** a partir da [Release v1.3.4](https://github.com/jimelyo/shoplogic/releases/tag/v1.3.4). ⚠️ A v1.3.4 está assinada com um **keystore novo**: não instala por cima da v1.2.0 oficial (assinatura distinta) — desinstale primeiro se vinha dessa versão.
2. Permita **instalar apps de origem desconhecida** para o seu navegador/gestor de ficheiros (Definições → Segurança) da primeira vez.
3. Abra o APK e instale-a. Requer **Android 6.0+ (API 23+)**. Sem permissões para além da internet: os dados vivem no IndexedDB dentro da app, 100% locais.

### Windows (recomendado — desktop)
1. Descarregue o **instalador v1.3.4** para a sua arquitetura (x64 e ARM64 na mesma release) a partir de [Releases](https://github.com/jimelyo/shoplogic/releases/latest):
   - `ShopLogic-Setup-1.3.4-x64.exe` (Windows 10/11 x64)
   - `ShopLogic-Setup-1.3.4-arm64.exe` (Windows on ARM)
2. Execute o instalador (instalação silenciosa com um só UAC). O atalho fica no ambiente de trabalho.
3. As atualizações passam a ser descarregadas e aplicadas **automaticamente** (v1.3.3 e anteriores atualizam-se sozinhas pelo mesmo canal electron-updater).

### macOS
1. Descarregue a **DMG v1.3.4** para a sua arquitetura a partir de [Releases](https://github.com/jimelyo/shoplogic/releases/latest):
   - `ShopLogic-1.3.4-x64.dmg` (Intel)
   - `ShopLogic-1.3.4-arm64.dmg` (Apple Silicon)
2. Abra a DMG e arraste a app para Aplicações. As atualizações seguintes também são automáticas (`latest-mac.yml`).
3. ⚠️ A DMG ainda **não está notarizada pela Apple**: da primeira vez o macOS pedirá «≡ Definições do Sistema → Privacidade e Segurança → Abrir Igualmente».

### Navegador (PWA)
- Sirva a build estática (`dist/`) com qualquer servidor web; também funciona abrindo o `index.html` local.
- Instalável como app a partir do Chrome/Edge ("Install ShopLogic Pro").

### Primeiro arranque
A app carrega dados de demonstração (telemóveis, clientes, reparações, faturas…) e estes utilizadores:

| Email | Palavra-passe | Perfil |
|---|---|---|
| `admin@shoplogic.com` | `admin123` | Administrador (tudo) |
| `manager@shoplogic.com` | `manager123` | Gestor |
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

### Build de macOS (DMG)

```bash
npm run build                   # build web para dist/
npx electron-builder --mac --x64 --arm64   # DMG x64 + arm64 em release/
```

### Build Android (Capacitor)

Requer um JDK 21 (o Java 25 do sistema ainda é incompatível com AGP) e envolve a build web numa shell nativa:

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
- **Fiscalidade**: módulo `src/verifactu/` (pegada AEAT, encadeamento, XML, SOAP, fila, QR) + assinatura XAdES no processo main (`xml-crypto` + `node-forge`).
- **Móvel**: Capacitor 8 (`capacitor.config.ts` + projeto `android/`), APK assinada com keystore via variáveis de ambiente.
- **i18n**: i18next + react-i18next, 5 recursos tipados em `src/i18n` (es · en · pt · zh · ar com RTL).
- **Testes**: Vitest + fake-indexeddb (155 testes), incluindo backups, credenciais, pegada AEAT, assinatura XAdES, retificativas e trade-in.

### Estrutura
```
src/
├── components/    # 25+ módulos UI (POS, Cash, Inventory, Repairs, Quotes, Billing, Reports, TradeIns…)
├── verifactu/     # Módulo fiscal Veri*factu: pegada, cadeia, XML, SOAP, fila, QR (+ testes)
├── lib/           # lógica core: calc, stock, invoices, cash, messaging, backup, csv, update, tradein…
├── db/            # esquema Dexie + dados demo
├── i18n/          # es, en, pt, zh, ar (1.016 chaves sincronizadas)
├── schemas/       # validação Zod de todos os formulários
└── types/         # modelos tipados do domínio
electron/          # processo principal, preload, updater e assinador XAdES
android/           # projeto Android nativo (Capacitor, build Gradle assinada)
server/            # relay SMTP local (127.0.0.1) para envios de email
public/            # service worker + manifest
```

---

## 📋 Novidades / Changelog (v1.3.4)

### 🛍️ Compras de segunda mão (trade-in)
- Módulo renomeado para **"Compras 2ª mão"** (navegação nos 5 idiomas) para avaliar, comprar e reabastecer terminais de segunda mão.
- Avaliação com custo + margem, registo da compra e **alta direta no inventário** com IMEI.
- **Rastreabilidade total**: cada compra é registada como movimento `trade_in` no ledger do produto, com origem e preço pago.

### 🧾 Retificativas R1–R5
- Emissão de **faturas retificativas (por diferenças)** a partir da Faturação e **deteção automática** em devoluções parciais/totais: a retificativa é gerada sozinha e enfileirada no Veri*factu com a sua referência à fatura original.

### 📈 Relatórios fiscais
- **Modelo 303 (IVA trimestral)** e **Modelo 347 (operações com terceiros)** nos Relatórios, com exportação **PDF e CSV** pronta para a declaração.

### 🔐 Hardening de segurança
- A palavra-passe do certificado `.p12` do Veri*factu passa a ser **encriptada com safeStorage** (DPAPI/Keychain) em vez de texto simples.
- O **relay SMTP local** escuta apenas em `127.0.0.1` e valida o cabeçalho `Origin`.
- **Bloqueio temporário do login** após falhas repetidas (backoff `30 s·2ⁿ`).
- **Backups encriptados opcionais AES-256-GCM** (PBKDF2 310k) com UI de encriptação/desencriptação nas Definições.

### 🎨 Nova identidade visual
- Logótipo corporativo novo no Electron (ico/icns), PWA, Android (mipmaps + splash) e social-preview do GitHub.

### Empacotamento multiplataforma
- Instaladores NSIS Windows **x64 e ARM64** + **DMG macOS x64/arm64** + **APK Android** (versionCode 134) e auto-update para desktop via `latest.yml` / `latest-mac.yml`.

---

## 🗺️ Histórico de releases

| Versão | Novidades principais |
|---|---|
| **v1.3.4** (Windows x64/ARM64 + macOS x64/ARM64 + Android) | **Compras 2ª mão** (trade-in com alta ao inventário e rastreabilidade) · **retificativas R1–R5** com deteção automática em devoluções · **relatórios fiscais Modelo 303 e 347** · hardening de segurança (safeStorage, SMTP localhost, bloqueio de login, backups AES-256-GCM) · novo logótipo em todas as plataformas |
| **v1.3.3** (Windows) | **Impressão do talão de reparação**: opção ao criar + pré-visualização modal · cabeçalho do talão sincronizado com o nome real da loja |
| **v1.3.2** (Windows x64 + ARM64) | **VERI*FACTU Companion**: assistente de certificado `.p12` com segurança no processo main · diagnóstico da fila AEAT + teste de ligação · centro de incidências com visualizador XML · declaração responsável exportável · empacotamento multi-arquitetura x64/ARM64 |
| **v1.3.0** (Windows) | **Veri\*factu completo (RD 1007/2023)**: pegada SHA-256 oficial com vetores AEAT · encadeamento · XML/SOAP SuministroLR · fila persistente com repetição automática · QR regulamentar no PDF · ecrã de incidências com erros AEAT · **assinador XAdES-Enveloped** com `.p12` local |
| **v1.2.0** (Windows + Android) | **Pesquisa global Ctrl+K** · **backup externo programado** · **Veri\*factu (Espanha)** com pegadas SHA-256 encadeadas · índices Dexie para catálogos grandes · workflow de CI de releases |
| **v1.1.0** (Windows) | Login por seleção de utilizador + palavra-passe · aviso demo eliminado |
| **v1.0.6** | Avisos por etapa da oficina (recebido/em curso/à espera de peças) em WhatsApp + email · ícone regenerado |
| **v1.0.5** | Novo ícone corporativo (telemóvel + chave + gráfico) no instalador, janela e PWA |
| **v1.0.4** | Instalador one-click (auto-update com um só UAC) · README completo |
| **v1.0.3** | Orçamentos convertíveis em venda/reparação · pagamentos divididos no TPV · atalhos F1-F4 · CSV por tabela · credenciais mascaradas nos backups · PWA offline real |
| **v1.0.2** | Versão visível no sidebar · banner de atualização não forçada |
| **v1.0.1** | Auto-update via GitHub Releases com electron-updater |

## 📄 Licença
Projeto privado. Todos os direitos reservados.
