# Firma de la app Android: keystore de release y secrets de GitHub

> Guía paso a paso de cómo se generó el keystore de release de ShopLogic Pro y
> cómo se configuraron los 4 secrets de GitHub Actions que usa el job `android`
> de `.github/workflows/release.yml` (y cualquier workflow que firme el APK).
>
> **Nada de esto guarda contraseñas ni el keystore en el repositorio.** El
> keystore vive en `~/keystores/` (esta Mac, fuera del repo) y las contraseñas
> solo van a GitHub como secrets cifrados.

## 1. Dónde están los ficheros (esta máquina)

| Fichero | Ruta | Qué es |
|---|---|---|
| Keystore de release | `~/keystores/shoplogic-release.jks` | RSA 4096, alias `shoplogic` |
| Contraseñas (2) | `~/keystores/shoplogic-secrets.txt` | `ANDROID_KEYSTORE_PASS=…` y `ANDROID_KEY_PASS=…` |

- Herramienta usada: `keytool` del JDK (Temurin 21), instalado en
  `~/tools/jdk21/jdk-21.0.12.1+9/Contents/Home` (tarball manual, sin sudo:
  `brew install openjdk@21` no tenía botella en esta config).
- Huella SHA‑256 del certificado: empieza por `6F:4E:65:03…`
  (verificar: paso 4).

## 2. Regenerar el keystore (si algún día hay que volver a crearlo)

⚠️ Regenerar el keystore crea una clave **distinta**: un APK firmado con el
keystore nuevo no actualizará sobre uno instalado con el viejo. Solo se hace si
se ha perdido el keystore o se quiere resetear la identidad de la app.

```bash
export JAVA_HOME="$HOME/tools/jdk21/jdk-21.0.12.1+9/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"

mkdir -p ~/keystores
keytool -genkeypair \
  -keystore ~/keystores/shoplogic-release.jks \
  -storetype JKS \
  -alias shoplogic \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=ShopLogic Pro, OU=Mobile, O=ShopLogic, L=Madrid, C=ES" \
  -storepass "$NUEVA_STORE_PASS" -keypass "$NUEVA_KEY_PASS"
```

- `ANDROID_KEYSTORE_PASS` = la contraseña del *keystore* (‑storepass)
- `ANDROID_KEY_PASS`     = la contraseña de la *clave* (‑keypass)
- Aunque las dos contraseñas sean iguales, sigue siendo necesario configurar **los dos
  secrets** por separado; el workflow los pasa a Gradle como `SL_KEYSTORE_PASS`
  y `SL_KEY_PASS` y `build.gradle` los declara independientes.

Escribe ambas contraseñas en `~/keystores/shoplogic-secrets.txt` (chmod 600, nunca en Git).

## 3. Configurar los secrets en GitHub

El job `android` de `release.yml` espera **exactamente estos 4 nombres** (Settings → Secrets and variables → Actions):

| Secret | Valor |
|---|---|
| `ANDROID_KEYSTORE_B64` | `base64` del keystore: `base64 -i ~/keystores/shoplogic-release.jks` |
| `ANDROID_KEYSTORE_PASS` | la contraseña del keystore (texto plano) |
| `ANDROID_KEY_PASS` | la contraseña de la clave (texto plano) |
| `ANDROID_KEY_ALIAS` | `shoplogic` |

Por UI: pega el base64 de una pieza (una sola línea) o usa los dos comandos de
abajo. **Si ANDROID_KEYSTORE_PASS / ANDROID_KEY_PASS no coinciden con el
keystore, el CI falla con `keystore password was incorrect`** — ese fue el error
de la v1.3.5: los secrets antiguos apuntaban a otro keystore.

## 4. Verificar que el par secret ↔ keystore es correcto

Localmente, simula lo que hace el CI (decodifica, firma un APK de prueba y
comprueba el certificado):

```bash
# 1) Decodificar el secret tal y como lo hará el workflow
echo "$ANDROID_KEYSTORE_B64" | base64 -d > /tmp/check.jks

# 2) Listar el certificado con las dos contraseñas de los secrets
keytool -list -v -keystore /tmp/check.jks -storepass "$ANDROID_KEYSTORE_PASS" \
  | grep "SHA256:"          # debe mostrar 6F:4E:65:03…
keytool -list -v -keystore /tmp/check.jks -alias shoplogic \
  -storepass "$ANDROID_KEYSTORE_PASS" -keypass "$ANDROID_KEY_PASS" >/dev/null \
  && echo "par passwords OK"   # falla aquí si KEY_PASS está mal
```

 (`keytool` pide la contraseña de la clave solo al *usarla*; por eso el segundo
  comando es el que detecta una `ANDROID_KEY_PASS` incorrecta.)

3) El APK firmado y subido a la release se verifica con apksigner:

```bash
apksigner verify --print-certs ~/Downloads/shoplogic-pro-1.3.5-android.apk
```

## 5. Cómo se consume en el build (mapping de variables)

`android/app/build.gradle` lee las contraseñas de variables de entorno `SL_*`;
el workflow las rellena desde los secrets (nunca en texto en el repo):

```text
Secret                     →  env del workflow            →  Gradle
ANDROID_KEYSTORE_B64       →  (se decodifica a fichero)   →  SL_KEYSTORE (ruta)
ANDROID_KEYSTORE_PASS      →  SL_KEYSTORE_PASS            →  keyProps['keystore.password']
ANDROID_KEY_ALIAS          →  SL_KEY_ALIAS                →  keyProps['key.alias']
ANDROID_KEY_PASS           →  SL_KEY_PASS                 →  keyProps['key.password']
```

## 6. Historia de esta sesión (v1.3.5)

- El keystore anterior era distinto de los secrets que había en el repo; el
  job `android` fallaba siempre con `keystore password was incorrect`.
- Se generó el keystore nuevo (RSA 4096 / alias `shoplogic`) en `~/keystores/`,
  se compiló y firmó el APK de la 1.3.5 **en local** (Capacitor 8 + Gradle,
  JDK Temurin 21) y se subió a la release `v1.3.5` como
  `shoplogic-pro-1.3.5-android.apk`.
- Los 4 secrets listados en el paso 3 quedaron configurados en el repositorio
  con los valores del keystore nuevo (cifrados y subidos vía API).
- A partir de la próxima release, el job `android` del CI firmará sin tocar nada:
  decodifica `ANDROID_KEYSTORE_B64` a `android/keystore/release.jks`, sincroniza
  la web (`npm run build && npx cap sync android`) y ejecuta
  `./gradlew assembleRelease`.
