# Informe de integración VERI*FACTU — ShopLogic Pro v1.3.0

**Fecha:** 13/10/2026 · **Estado del repo:** cambioslocales SIN subir a GitHub.

---

## 1. Arquitectura implementada

```
┌────────────────────────── ShopLogic Pro (React+TS, IndexedDB) ──────────────────────────┐
│  POS / Reparaciones / Billing  ──createInvoiceFromSale/Repair()──▶ invoices.ts          │
│                                                                       │                 │
│                                              emiteAlta / emiteAnulacion│                 │
│                                                                       ▼                 │
│  src/verifactu/ ─ Servicio fiscal desacoplado (no altera la lógica de negocio)          │
│   • fiscal-hash.ts    Huella SHA-256 oficial AEAT (doc. 0.1.2, vectores incluidos)     │
│   • fiscal-chain.ts   Encadenamiento art. 7/13 Orden HAC/1177/2024                     │
│   • aeat-xml.ts       XML de Alta/Anulación/Lote según SuministroLR.xsd                │
│   • aeat-soap.ts      SOAP 1.1 → prewww1/ www1 + parser RespuestaSuministro            │
│   • queue.ts          Cola persistente (Dexie v10) PERSISTED→…→ACCEPTED + reintentos   │
│   • fiscal-qr.ts      QR reglamentario (ValidarQR / ValidarQRNoVerifactu)              │
│   • service.ts        VerifactuService (fachada desde el ERP)                          │
│   • audit.ts          verifyChain + export CSV (auto-auditoría)                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- La **factura se persiste SIEMPRE** (patrón outbox): si falla la emisión fiscal,
  la factura queda con estado `verifEnvio: 'queued'` y nunca se pierde ni se
  duplica. No se crean facturas dobles por fallos de red.
- La cola es **persistente y recuperable tras reinicio** (`recoverQueue()`).
- La modalidad y el entorno (test/producción) se configuran en Settings →
  Billing → Veri*factu.

## 2. Ficheros creados / modificados

| Fichero | Acción | Contenido |
|---|---|---|
| `src/verifactu/fiscal-types.ts` | NUEVO | Tipos y códigos oficiales (ClaveRegimen, TipoFactura, TipoHuella=01) |
| `src/verifactu/fiscal-hash.ts` | NUEVO | Huella AEAT oficial + **3 vectores de prueba oficiales** |
| `src/verifactu/fiscal-chain.ts` | NUEVO | chainAlta/chainAnulacion |
| `src/verifactu/aeat-xml.ts` | NUEVO | altaSoap/anulacionSoap/registrosSoap (lote ≤1000) |
| `src/verifactu/aeat-soap.ts` | NUEVO | sendSoap + parseSuministroResponse + WSDL/endpoints |
| `src/verifactu/queue.ts` | NUEVO | Cola Dexie v10, reintentos con backoff, recoverQueue |
| `src/verifactu/fiscal-qr.ts` | NUEVO | QR reglamentario (URLs test/prod y marcos VERI*FACTU/NO) |
| `src/verifactu/service.ts` | NUEVO | emitAlta/emitAnulacion/invoiceQrUrl/onChainStartup |
| `src/verifactu/audit.ts` | NUEVO | verifyChain (nueva firma) + verifactuCsv |
| `src/verifactu/index.ts` | NUEVO | Barrel público |
| `src/verifactu/__tests__/*.test.ts` | NUEVO | 26 pruebas de los vectores AEAT / XML / QR / cadena |
| `src/verifactu/README.md` | NUEVO | Documentación técnica con fuentes oficiales |
| `src/db/database.ts` | MOD. | **Migración Dexie v10**: tabla `verifactuQueue` |
| `src/types/index.ts` | MOD. | `Invoice.verifEnvio/.verifCSV/.verifLastResponse`; `settings.verifactuConfig` |
| `src/lib/invoices.ts` | MOD. | Integración con emitAlta/emitAnulacion vía cancelInvoiceWithVerifactu |
| `src/lib/pdf.ts` | MOD. | **QR reglamentario** (35mm, nivel M) + leyenda oficial en `invoicePdf` |
| `src/components/Billing.tsx` | MOD. | `invoicePdf` ahora `async` |
| `src/components/Settings.tsx` | MOD. | Panel `FiscalConfigFields` + `FiscalStatus` (estado de remisión) |
| `src/components/shared/FiscalStatus.tsx` | NUEVO | UI de estado de cola y auto-auditoría |
| `src/lib/verifactu.ts` | ELIMINADO | Reemplazado por el módulo `src/verifactu/` |
| `package.json` | MOD. | `version: 1.3.0`, `qrcode` + `@types/qrcode` |

## 3. Migraciones

- **Dexie v10**: solo añade la tabla `verifactuQueue`, sin tocar los datos existentes.
  Las facturas históricas **NO** se marcan como emitidas en Veri*factu (no reciben huella).

## 4. Dependencias añadidas

- `qrcode` + `@types/qrcode`: para el QR reglamentario en el PDF de factura (ISO/IEC 18004, nivel M).

## 5. Endpoints e interfaces

- `emitAlta(inv, settings)` / `emitAnulacion(inv, settings)` / `invoiceQrUrl(inv, settings)` / `queueStatusOfInvoice(id)` (src/verifactu/service.ts).
- UI: Settings → Billing → Veri*factu (activar, modalidad, entorno, estado).
- SOAP envío: `prewww1.aeat.es` (pruebas) / `www1.agenciatributaria.gob.es` (producción), sobrescribible
  vía `SOAP_ENDPOINTS` para certificado de sello (`www10/prewww10`).

## 6. Funcionalidades fiscales terminadas

| Función | Estado |
|---|---|
| Cálculo de huella oficial SHA-256 (3 vectores AEAT verificados) | ✅ IMPLEMENTADA Y PROBADA |
| Encadenamiento de registros (art. 7) | ✅ IMPLEMENTADA Y PROBADA |
| Registro de anulación (huella + XML) | ✅ IMPLEMENTADA Y PROBADA |
| XML de alta/anulación según esquema SuministroLR/Informacion | ✅ IMPLEMENTADA Y PROBADA (parser-textual contra el mensaje oficial del doc. 1.0.3) |
| Lotes hasta 1000 registros | ✅ IMPLEMENTADA |
| QR reglamentario (URL oficial + formatos) | ✅ IMPLEMENTADA Y PROBADA |
| QR en PDF de factura con leyenda «Factura verificable en la sede electrónica de la AEAT» | ✅ IMPLEMENTADA Y PROBADA |
| Cola persistente con estados, reintentos y recuperación | ✅ IMPLEMENTADA (con tests de unidad parciales) |
| Parser de respuesta AEAT (Correcto / AceptadoConErrores / Incorrecto) | ✅ IMPLEMENTADA |
| UI de estado de la remisión en Settings | ✅ IMPLEMENTADA |
| Auto-auditoría visual de la cadena (verifyChain) | ✅ IMPLEMENTADA |
| **Firma electrónica XAdES-Enveloped de los registros (art. 14)** | ⚠️ PENDIENTE — requiere certificado del obligado y librería de firma; el XML queda listo para firmar |
| **Envío real a AEAT (auth TLS-cliente)** | ⚠️ BLOQUEADA — exige certificado electrónico cualificado instalado |
| Pruebas contra el entorno real de preproducción de la AEAT | ⚠️ PENDIENTE — requiere certificado del operador |

## 7. Pruebas ejecutadas y resultados reales

- `npx tsc -b` → `✅ 0 errores` (build TypeScript completo).
- `npm test` (vitest) → **`Test Files 11 passed · Tests 104 passed`**, incluidos:
  - `fiscal-hash.test.ts` — **3 vectores oficiales del doc. AEAT v0.1.2** reproducidos byte a byte.
  - `aeat-xml.test.ts` — XML contra el ejemplo oficial del doc. AEAT v1.0.3 §9.1.1.1/§9.2.1
    + lote máx. 1000 + escape XML.
  - `fiscal-qr.test.ts` — URLs de producción y pruebas exactas; `ValidarQRNoVerifactu` separado;
    tamaño 30–40 mm, nivel M, leyenda oficial.
  - `chain-queue.test.ts` — encadenamiento idempotente y sensible a cualquier cambio de los campos.

## 8. Pruebas pendientes / requisitos de config.

- **Certificado electrónico del obligado** (AES de representación o sello).
- **Prueba integración con Preproducción** (`prewww1.aeat.es`) — espera CSV real o `Incorrecto`
  del AEAT, que será el único resultado autoritativo.
- En producción, montar el firmador **XAdES Enveloped** según ETSI EN 319 132.

## 9. Pasos para configurar el entorno de pruebas AEAT

1. Obtener el **certificado digital del representante del obligado tributario** o un sello.
2. Settings → Billing → **Veri*factu**: seleccionar modalidad `VERI*FACTU`, entorno `Pruebas (preproducción)`.
3. El SOAP se dirige a `prewww1.aeat.es` — requiere configurar el transporte `mTLS` con el
   certificado en el navegador u sobrescribir `SOAP_ENDPOINTS.test` si el operador dispone
   de un servicio proxy de firma.
4. Remitir una factura numerada con tu NIF operador y verificar la respuesta con `EstadoEnvio=Correcto`.
5. Alternar a producción **solo después de** habilitar el envío firmado contra `www1…`.

## 10. Riesgos y limitaciones

- **SDS:** el modo `PASs` no envía a producción si no existe certificado configurado.
- Las facturas históricas (anteriores a 1.3.0) NO se re-registran en Veri*factu; el histórico
  queda fuera de la cadena local y así se documenta — no se falsean huellas.
- El CSV de cotejo (AEAT) NO es el CSV interno de auditoría — está documentado en README.
- Queda fuera de alcance: gestión de rectificativas R1–R5 completas (solo pantalla básica R1
  disponible si antes hubo errores), eventos de subsanación, y firma electrónica de lote.

## 11. Cómo ejecutar el sistema

```bash
npm install          # incluye qrcode
npm test             # 104 tests (26 de fiscalidad VERI*FACTU)
npx tsc -b           # build typecheck completo
npm run dev          # vite dev server
```

## 12. Declaración responsable — CONTENIDO PREPARADO, PENDIENTE DE COMPLETAR

El productor del SIF debe completar en `settings.verifactuConfig.system`:

- `NombreRazonSocial` y `NIF` **del productor del software** (Ҁuesto, no fabricado aquí).
- `IdSistemaInformatico`, `Version` 1.3.0, `NumeroInstalacion` (único por instalación).
- La AEAT no homologa software: la declaración responsable es un documento del
  **productor** avalando el RD 1007/2023 — no emitimos esa certificación aquí.

---

**Verificado:** código compila y las pruebas (con vectores oficiales de la AEAT) pasan.
**No verificado:** envío real a la sede AEAT (requiere certificado) y firma XAdES.
