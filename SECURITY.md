# Security notes

## node-forge advisory (GHSA-86w9-cpqp-85rv)

`node-forge@1.4.0` has a high-severity advisory in **RSA PKCS#1 v1.5 signature
verification** (extra nested `DigestAlgorithm` elements are accepted). There is
no fixed release yet.

ShopLogic uses node-forge only to:

- parse `.p12`/`.pfx` containers (`forge.pkcs12`), and
- export certificate/private-key PEM material for `xml-crypto`.

It never calls a node-forge signature-verification API. `npm run security:forge`
walks `electron/` and `src/` and fails if a `verify()` path appears, so the
advisory cannot silently become reachable. When a fixed release exists, upgrade
and remove this guard.

## Signing and notarization

- **Windows**: set `WINDOWS_CSC_LINK` (base64 PFX or path) and
  `WINDOWS_CSC_KEY_PASSWORD` in the release workflow. Without them the NSIS
  installer is built unsigned (SmartScreen warning).
- **macOS**: set `MACOS_CSC_LINK`, `MACOS_CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`. `scripts/notarize.cjs`
  runs as `afterSign` and skips cleanly when credentials are absent.
- **Android**: the release workflow already signs with `ANDROID_KEYSTORE_B64`.

## Reporting

This is a private project. Report security issues directly to the maintainer;
do not open a public issue with exploit details.
