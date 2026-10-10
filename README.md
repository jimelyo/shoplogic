# 📱 ShopLogic Pro

<p align="center">
  <img src="public/icon-512.png" width="128" alt="ShopLogic Pro">
</p>

**ERP + TPV completo para tiendas de telefonía y accesorios** — ventas, cajas, inventario con trazabilidad, taller de reparaciones, facturación, reportes y automatizaciones de mensajería. Funciona 100% local (tus datos nunca salen de tu equipo) y se actualiza sola desde GitHub Releases.

[![Release](https://img.shields.io/github/v/release/jimelyo/shoplogic)](https://github.com/jimelyo/shoplogic/releases)
[![Plataforma](https://img.shields.io/badge/Windows-x64%20%7C%20arm64-blue)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Licencia](https://img.shields.io/badge/uso-privado-informational)]()

---

## ✨ Funcionalidades

### 🛒 Punto de Venta (TPV)
- Cobro con **un toque** desde tarjetas de producto o tabla, con catálogo filtrado por categorías.
- **Pagos divididos**: cobra una venta con varios medios a la vez (ej. 20 € efectivo + resto tarjeta), reparto validado antes de cobrar y reflejado en el ticket.
- Descuentos por % o importe fijo, IVA incluido con desglose en pantalla.
- **Escáner de códigos**: por lector USB (escribe en el buscador) o con la **cámara** (códigos EAN/UPC/Code128/QR e IMEI) vía API nativa `BarcodeDetector`.
- **Atajos de teclado**: `F1` buscar · `F2` cobrar · `F3` escanear · `F4` vaciar carrito.
- Puntos de fidelidad automáticos por importe de compra.
- Ticket imprimible (58/80 mm) con logo y envío de recibo por **WhatsApp o email**.

### 📋 Presupuestos
- Crea un presupuesto de **venta o reparación** con líneas, validez y notas.
- Flujo: borrador → enviado → aceptado → **convertir con un clic**:
  - → **Venta** (descuenta stock en transacción atómica)
  - → **Reparación** (crea el ticket pre-llenado con dispositivo/IMEI/problema/coste)
- Caducidad automática y presupuesto imprimible estilo ticket.

### 📦 Inventario y movimientos
- Productos con código de barras, IMEI, coste, PVP (IVA incl.), stock mínimo y márgenes calculados.
- Alertas de stock bajo/agotado con notificaciones automáticas.
- **Historial de movimientos por producto** (ledger): ventas, compras, ajustes y devoluciones con saldo anterior/posterior.
- Categorías personalizables con icono y color.
- Escáner de cámara para buscar productos.

### 🔧 Taller de reparaciones
- Tickets `R-000001` con cliente, dispositivo, IMEI, problema, diagnóstico y evolución de estados (recibido → diagnóstico → en proceso → esperando piezas → completado → entregado).
- Aviso al cliente por WhatsApp/email al completar (automatizable), con resguardo imprimible.
- Ficha de **historial por IMEI** con garantía configurada.
- Facturación automática al entregar (opcional).

### 💶 Caja
- Apertura/cierre de turnos con fondo inicial, depósitos y retiradas.
- Arqueo esperado vs contado con diferencia calculada, corte por venta (efectivo), facturas y devoluciones.

### 🧾 Facturación
- Numeración configurable (secuencial, por fecha, por año o formato personalizado), serie y prefijos.
- Estados (borrador, enviada, pagada, parcial, vencida, cancelada) con cobros parciales.
- **PDF profesional** con marca de agua, copias normalizadas y ticket de ventas.

### 👥 Clientes, proveedores y compras
- Ficha 360° del cliente: gasto total, visitas, puntos, historial de dispositivos por IMEI.
- Proveedores con contactos y pedidos de compra con **recepción parcial**.
- **Reposición asistida**: genera un borrador de pedido con todos los productos bajo stock mínimo en un clic.

### 📈 Reportes
- Ventas, beneficio, margen, ventas por categoría, reparaciones por estado.
- Resumen financiero (ingresos, gastos, balance) y exportación **PDF de cualquier informe**.

### 🤖 Automatizaciones y mensajería
- **Avisos por etapa del taller**: cada cambio de estado de una reparación puede notificar al cliente automáticamente:
  - 📥 Recibido → WhatsApp
  - 🛠️ En proceso → WhatsApp + Email
  - ⏰ Esperando piezas → WhatsApp + Email
  - ✅ Lista / Completada → WhatsApp + Email (resumen con coste final)
- Automatizaciones configurables adicionales: recibos de venta por WhatsApp, resumen diario, backup diario, alertas de stock y facturas vencidas…
- **WhatsApp** en dos modos: enlace directo `wa.me` (sin servidor) o **Cloud API** oficial.
- **Email** con presets de Gmail/Outlook/SMTP genérico.
- Cola de envío (outbox) con reintentos al reiniciar si el servidor relay no estaba disponible.
- Todo el uso queda registrado en la auditoría (quién envió qué y cuándo).

### ⚙️ Configuración y datos
- Multiples monedas (EUR, USD, GBP, MXN, ARS, COP, CLP, BRL, CNY, MAD), IVA configurable.- Marca propia: nombre de la app, logo, datos fiscales del comercio en tickets/PDF.
- 5 idiomas: **Español, English, Português, 中文, العربية** (con RTL para árabe).
- Tema claro/oscuro + 6 colores de acento.
- Bloqueo de pantalla por inactividad con contraseña.
- RBAC por roles: **admin, manager, técnico, cajero**, con matriz de permisos editable módulo a módulo.
- Gestión de datos: export/import JSON completo, **exportación CSV por tabla (Excel)**, reset selectivo con backup previo automático.
- Auditoría: registro de acciones (login, ventas, modificaciones, envíos, impresiones) con usuario y fecha.

### 🔄 Auto-actualizaciones
- **Escritorio (Electron)**: consulta GitHub Releases al arrancar y cada 30 min; descarga en segundo plano con **descarga diferencial** (blockmaps), progreso visible y banner descartable por versión; la instalación se aplica al cerrar la app con **un solo UAC** (instalador one-click, sin asistente).
- **PWA (navegador)**: service worker detecta la nueva versión y la aplica al recargar (automático si lo activas en Apariencia → Actualización).
- **Offline real**: el service worker precachea todos los assets — funciona sin conexión desde la primera visita.

---

## 🔐 Seguridad y privacidad

- **100% local**: la base de datos vive en IndexedDB de tu navegador/equipo. Nada se envía a ningún servidor (los envíos de WhatsApp/email salen directamente de tu máquina o de tu propio relay).
- Contraseñas con **PBKDF2-SHA256 (210.000 iteraciones)** + salt aleatorio por usuario, comparación en tiempo constante y upgrade automático de hashes antiguos.
- Las **credenciales de mensajería quedan enmascaradas** en el snapshot diario on-disk; el backup manual completo las incluye solo si tú lo pides, avisado en la UI.
- Los backups importados se **validan fila a fila** antes de restaurar.
- Electron con `contextIsolation` + sandbox y sin integración de Node en el renderer.

---

## 🚀 Instalación

### Windows (recomendado — escritorio)
1. Descarga el instalador para tu arquitectura desde [Releases](https://github.com/jimelyo/shoplogic/releases/latest):
   - `ShopLogic-Setup-x.y.z-x64.exe` (Windows 10/11 x64)
   - `ShopLogic-Setup-x.y.z-arm64.exe` (Windows on ARM)
2. Ejecuta el instalador (instalación silenciosa con un solo UAC). El acceso directo queda en el escritorio.
3. Las actualizaciones se descargan y aplican **automáticamente** a partir de ahí.

### Navegador (PWA)
- Sirve la build estática (`dist/`) con cualquier servidor web; también funciona abriendo `index.html` local.
- Instalable como app desde Chrome/Edge ("Install ShopLogic Pro").

### Primer arranque
La app carga datos de demostración (productos móviles, clientes, reparaciones, facturas…) y estos usuarios:

| Email | Contraseña | Rol |
|---|---|---|
| `admin@shoplogic.com` | `admin123` | Administrador (todo) |
| `manager@shoplogic.com` | `manager123` | Manager |
| `tecnico@shoplogic.com` | `tecnico123` | Técnico |
| `cajero@shoplogic.com` | `cajero123` | Cajero |

> ⚠️ **Cambia esas contraseñas o elimina esos usuarios antes de usar la app en producción** (Usuarios → editar).

---

## 🛠️ Desarrollo

```bash
npm install          # dependencias
npm run dev          # Vite dev server (PWA en el navegador)
npm run start        # aplica la build a Electron local
npm run build        # build de producción (tsc + vite)
npm run dist         # empaqueta Windows x64 + arm64 con electron-builder
npm test             # tests unitarios (vitest)
npm run lint         # oxlint
npm run check:i18n   # comprueba 5 locales con llaves idénticas
```

### Stack
- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + Zustand.
- **Datos**: Dexie (IndexedDB) con transacciones atómicas; modelos tipados en `src/types`.
- **Escritorio**: Electron 44 + electron-updater con Releases de GitHub.
- **Testing**: Vitest + fake-indexeddb (78 tests), incluidos tests de backups y credenciales.

### Estructura
```
src/
├── components/    # 25+ módulos UI (POS, Cash, Inventory, Repairs, Quotes, Billing, Reports…)
├── lib/           # lógica core: calc, stock, invoices, cash, messaging, backup, csv, update…
├── db/            # esquema Dexie + datos demo
├── i18n/          # es, en, pt, zh, ar (873 claves sincronizadas)
├── schemas/       # validación Zod de todos los formularios
└── types/         # modelos tipados del dominio
electron/          # proceso principal, preload y updater
public/            # service worker + manifest
```

---

## 🗺️ Historial de releases

| Versión | Novedades principales |
|---|---|
| **v1.0.6** | Avisos por etapa del taller (recibido/en proceso/esperando piezas) en WhatsApp + email · icono regenerado |
| **v1.0.5** | Nuevo icono corporativo (teléfono + llave + gráfico) en instalador, ventana y PWA |
| **v1.0.4** | Instalador one-click (auto-update con un solo UAC) · README completo |
| **v1.0.3** | Presupuestos convertibles en venta/reparación · pagos divididos en TPV · atajos F1-F4 · CSV por tabla · credenciales enmascaradas en backups · PWA offline real |
| **v1.0.2** | Versión visible en el sidebar · banner de actualización no forzada |
| **v1.0.1** | Auto-update vía GitHub Releases con electron-updater |

## 📄 Licencia
Proyecto privado. Todos los derechos reservados.
