# 📝 Prompt: recrear ShopLogic Pro desde cero

> Copia todo el bloque de abajo y dáselo a cualquier IA de código (Claude Code, Cursor, Codebuff, etc.) para que genere la aplicación completa con todas sus opciones.

---

## El prompt

Actúa como desarrollador senior fullstack. Genera una aplicación ERP + TPV (punto de venta) completa, profesional y con calidad de producción, llamada **ShopLogic Pro**, para tiendas de telefonía y accesorios. Todo el código debe funcionar 100% offline y local (los datos nunca salen del equipo del usuario, salvo los mensajes que él mismo envíe por WhatsApp/email).

### Stack tecnológico obligatorio

- **Frontend**: React 19 + TypeScript estricto + Vite 7 + Tailwind CSS 4 (tema claro/oscuro con 6 colores de acento configurables) + Zustand para estado global + lucide-react para iconos.
- **Base de datos**: Dexie (IndexedDB) con transacciones atómicas, esquema versionado y datos demo precargados. Modelos tipados en `src/types`.
- **Escritorio**: Electron 44 con `contextIsolation` + sandbox, sin integración de Node en el renderer, empaquetado con electron-builder para Windows x64 + arm64.
- **Móvil**: Capacitor 8 con proyecto Android nativo (`com.jimelyo.shoplogic`, minSdk 23), APK firmada con keystore leído de variables de entorno (`SL_KEYSTORE`, `SL_KEYSTORE_PASS`, `SL_KEY_ALIAS`, `SL_KEY_PASS`), nunca versionado.
- **PWA**: manifest + service worker que precachea todos los assets (offline real desde la primera visita).
- **Testing**: Vitest + fake-indexeddb, al menos 78 tests unitarios (cálculos, stock, backups, cash).
- **Validación**: Zod en todos los formularios (`src/schemas`).
- **i18n**: i18next + react-i18next con 5 locales completos y sincronizados (~872 claves cada uno): Español (por defecto), English, Português, 中文 y العربية con **soporte RTL completo** (`dir=rtl` + utilidades lógicas de Tailwind). Idioma persistido en localStorage.

### Módulos funcionales (todos, sin excepciones)

1. **Login con selección de usuario**: pantalla con tarjetas por cada usuario activo (avatar con inicial + nombre + rol); al elegir uno, pide solo su contraseña, con botón para volver. Sin selector de email. Sin ningún aviso de credenciales demo en pantalla. Contraseñas con PBKDF2-SHA256 a 210.000 iteraciones + salt, comparación en tiempo constante y upgrade automático de hashes antiguos.
2. **Punto de Venta (TPV)**: cobro con un toque desde tarjetas de producto o tabla; catálogo filtrado por categorías; **pagos divididos** (varios medios en una venta, con validación de reparto); descuentos por % o importe fijo; IVA incluido con desglose; escáner de códigos por lector USB y por **cámara** usando la API nativa `BarcodeDetector` (EAN/UPC/Code128/QR e IMEI); atajos de teclado F1 buscar, F2 cobrar, F3 escanear, F4 vaciar carrito; puntos de fidelidad automáticos; ticket imprimible de 58/80 mm con logo y envío por WhatsApp o email.
3. **Presupuestos**: documentos de venta o reparación con líneas, validez y notas; flujo borrador → enviado → aceptado → caducado; **conversión con un clic** a venta (descuenta stock en transacción atómica) o a reparación (crea el ticket pre-llenado con dispositivo/IMEI/problema/coste); presupuesto imprimible estilo ticket.
4. **Inventario con trazabilidad**: productos con código de barras, IMEI, coste, PVP con IVA, stock mínimo y márgenes calculados; alertas de stock bajo/agotado; **ledger de movimientos por producto** (ventas, compras, ajustes, devoluciones) con saldo anterior/posterior; categorías con icono y color personalizables.
5. **Taller de reparaciones**: tickets numerados `R-000001` con cliente, dispositivo, IMEI, problema, diagnóstico y estados (recibido → diagnóstico → en proceso → esperando piezas → completado → entregado); **avisos automáticos al cliente por WhatsApp/email por cada cambio de etapa**; historial por IMEI con garantía; facturación automática opcional al entregar.
6. **Caja**: apertura/cierre de turnos con fondo inicial, depósitos y retiradas; arqueo esperado vs contado con diferencia; corte por ventas en efectivo, facturas y devoluciones.
7. **Facturación**: numeración configurable (secuencial, por fecha, por año o formato personalizado) con serie y prefijos; estados (borrador, enviada, pagada, parcial, vencida, cancelada) con cobros parciales; **PDF profesional con marca de agua y copias normalizadas** (generado con jsPDF).
8. **Clientes, proveedores y compras**: ficha 360° del cliente (gasto total, visitas, puntos, historial de dispositivos por IMEI); proveedores con contactos; pedidos de compra con **recepción parcial**; **reposición asistida** que genera un borrador de pedido con todos los productos bajo stock mínimo.
9. **Reportes**: ventas, beneficio, margen, ventas por categoría (chart.js), reparaciones por estado; resumen financiero; exportación a PDF de cualquier informe.
10. **Automatizaciones**: motor configurable de avisos (recibo de venta por WhatsApp, resumen diario al cerrar, backup diario, alertas de stock, facturas vencidas, avisos por etapa del taller); **WhatsApp en dos modos**: enlace directo `wa.me` sin servidor o Cloud API oficial; email con presets Gmail/Outlook/SMTP genérico; cola de envío (outbox) con reintentos al reiniciar; cada uso registrado en auditoría.
11. **Configuración y datos**: múltiples monedas (EUR, USD, GBP, MXN, ARS, COP, CLP, BRL, CNY, MAD) e IVA configurable; marca propia (nombre de app, logo, datos fiscales en tickets/PDF); tema y acentos; **bloqueo de pantalla por inactividad con contraseña**; export/import JSON completo validado fila a fila; **exportación CSV por tabla**; reset selectivo con backup previo automático.
12. **RBAC**: roles admin, manager, técnico y cajero con **matriz de permisos editable módulo a módulo**.
13. **Auditoría**: registro de acciones (login, ventas, modificaciones, envíos, impresiones) con usuario y fecha.

### Auto-actualizaciones

- **Escritorio**: consulta GitHub Releases al arrancar y cada 30 min (electron-updater); descarga en segundo plano con **descarga diferencial** (blockmaps), progreso visible, banner descartable por versión, instalación al cerrar con un solo UAC (instalador one-click NSIS sin asistente).
- **PWA**: el service worker detecta nueva versión y la aplica al recargar (activable/desactivable en Apariencia → Actualización).

### Seguridad

- 100% local: nada se envía a servidores; los mensajes salen de la máquina del usuario o de su propio relay.
- Credenciales de mensajería **enmascaradas** en el snapshot diario en disco; incluidas en backups completos solo si el usuario lo pide explícitamente, avisado en la UI.
- Backups importados validados fila a fila antes de restaurar.

### Build y empaquetado

- `npm run dist` → icono + build + electron-builder Windows x64/arm64.
- Android: `npm run build && npx cap sync android && cd android && ./gradlew assembleRelease` con JDK 21 (Java 25 aún no es compatible con el Android Gradle Plugin) y las variables `SL_KEYSTORE*`.
- `npm run check:i18n` debe validar que los 5 locales tienen exactamente las mismas claves.

### Entregable

Genera el proyecto completo y funcional con README profesional (instalación Windows + Android + PWA, sección de idiomas, historial de releases) y verify sin rodeos: `npm test` (78/78), `npm run lint` (0 errores), `npm run build` y `npm run check:i18n` en verde.
