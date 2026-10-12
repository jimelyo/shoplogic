# Módulo VERI*FACTU (ShopLogic Pro)

Módulo desacoplado que implementa la parte **VERI*FACTU** del Reglamento de
Sistemas Informáticos de Facturación (RD 1007/2023) y su desarrollo en la
**Orden HAC/1177/2024** y la resolución TIKE-CONT de la AEAT de 18/12/2024.

## Estructura

```
src/verifactu/
├── fiscal-types.ts    Tipos del módulo (códigos oficiales de la AEAT)
├── fiscal-hash.ts     Huella SHA-256 (documento oficial 0.1.2, vectores de prueba)
├── fiscal-chain.ts    Encadenamiento de huellas (art. 7 y 13 de la Orden)
├── aeat-xml.ts        XML de alta / anulación / lotes según SuministroLR.xsd
├── aeat-soap.ts       Cliente SOAP 1.1 + parser de RespuestaSuministro
├── queue.ts           Cola persistente (Dexie v10) con estados y reintentos
├── fiscal-qr.ts       QR reglamentario (ValidarQR / ValidarQRNoVerifactu)
├── service.ts         VerifactuService (fachada desde el ERP)
└── index.ts           Exportaciones públicas
```

## Fuentes oficiales utilizadas (vigentes a 13/10/2026)

- **Orden HAC/1177/2024** (art. 7, 10–13, 20–21, anexo).
  Consolidado BOE-A-2024-22138 — `www.boe.es/buscar/act.php?id=BOE-A-2024-22138`.
- **Especificaciones de la huella** (v 0.1.2, 27/08/2024):
  `www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf`.
- **Descripción del servicio web** (v 1.0.3): WSDL/endpoint, XSDs, ejemplos de
  mensajes de alta y anulación:
  `sede.agenciatributaria.gob.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf`.
- **WSDL de PRUEBAS y PRODUCCIÓN** (Anexo I del mismo doc).
- **QR**: `sede.agenciatributaria.gob.es/Sede/iva/.../caracteristicas-qr-especificaciones-servicio-cotejo-factura.html`
  + FAQ desarrolladores (04-12-2025).

## Estados de la cola (internos de la aplicación, NO de la AEAT)

`PERSISTED → QUEUED → SENDING → ACCEPTED | ACCEPTED_WITH_ERRORS | REJECTED | RETRY_PENDING`

Reintentos con backoff (15 s, 1 min, 10 min, 1 h). Tras un reinicio,
`recoverQueue()` recupera entradas colgadas en `SENDING`.

## Limitaciones y configuración pendiente del operador

La remisión real exige **certificado electrónico cualificado** del obligado
(mTLS con AES/representación o sello firma remota). El cliente SOAP está
implementado y la cola de reintentos también, PERO:

- La firma XAdES-Enveloped (art. 14 de la Orden) se deja como **pasos
  pendientes de integración** — se requiere librería de firma (p. ej.
  `node-forge`-based o `xml-crypto` en su variante ES) y el certificado
  `.p12`/`.pfx` del obligado, instaldos por el operador.
- Sin certificado NO se envía: el XML queda encola­do y la factura queda
  `queued` (pendiente). Nunca se fantasea con un `ACCEPTED` falso.
- Los endpoints del SOAP de sello (`www10/prewww10.agenciatributaria.gob.es`
  disponibles para certificado de sello) se pueden sobrescribir con
  `SOAP_ENDPOINTS[env]` antes de emitir.

## Configuración sugerida del operador (PASOS)

1. En **Settings → Fiscal**: fijar el NIF del productor del SIF (p. ej. el
   propio del desarrollador o del obligado) y el `NumeroInstalacion` (1–100000)
   para cada tienda.
2. Instalar el certificado en el navegador/sistema del equipo del cajero
   (mTLS el navegador lo gestionará al hacer `fetch` a `prewww1/`) — o
   desplegar un componente de firma por lotes para el modo offline.
3. Seleccionar `environment = test` y probar contra la preproducción (una
   factura ficticia con su NIF) antes de activar producción.
4. Para el QR compartido: dejarlas apuntar a producción (URL por defecto del
   QR); las URLs de preproducción no valen para facturas reales.

## Compatibilidad con el resto de la aplicación

- `src/lib/invoices.ts` llama a `emitAlta()`/`emitAnulacion()` tras crear/
  anular facturas (`s.verifactu?.enabled`).
- `Settings → Fiscal` expone la configuración, el estado de la cola y la
  exportación CSV/JSON de los registros emitidos.
- La factura guarda `verifHash`, `verifPrevHash`, `verifTime`, `verifEnvio`
  (estado AEAT) y `verifCSV` en su fila del tipo `Invoice`.
