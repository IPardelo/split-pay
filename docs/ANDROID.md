# Split Pay en Android

Volver ao [README](../README.md).

A app é web por dentro, e **Capacitor** métea nun proxecto Android nativo: un APK normal,
co seu icono e o seu nome, que funciona sen internet e sen navegador á vista.

## O que precisas

- **Node 20 ou superior**.
- **Android Studio** co SDK de Android instalado (o asistente da primeira execución
  encárgase). Trae dentro o JDK que fai falta.

## Os tres comandos

```bash
npm install          # unha vez
npm run android:init # SÓ A PRIMEIRA VEZ: crea a carpeta android/
npm run android      # compila, sincroniza e abre Android Studio
```

En Android Studio dálle a **Run ▶** co teléfono conectado (coa depuración USB activada) ou
cun emulador. Iso instala e abre a app.

Cada vez que cambies o código:

```bash
npm run android      # ou npm run android:sync, se xa tes Android Studio aberto
```

`android:sync` volve compilar a web e copia o resultado dentro do proxecto Android. **Se
non o executas, o APK segue coa versión vella.** É o erro máis común.

## Permiso da cámara

O escáner de códigos QR precisa a cámara. Abre
`android/app/src/main/AndroidManifest.xml` e engade esta liña dentro de `<manifest>`, antes
de `<application>`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

Hai que facelo **unha soa vez**: `npm run android:sync` non pisa ese ficheiro.

Sacar fotos aos tickets **non** precisa este permiso, porque abre a app de cámara do
sistema a través do selector de ficheiros.

Se aínda así o escáner non abre a cámara, non insistas co permiso: o WebView do teléfono
pode ser vello de máis para a API de lectura de códigos. Nese caso a app dío soa e podes
pegar o código a man.

## Nome e icono

- **Nome**: `appName` en `capacitor.config.ts`. Despois de cambialo, `npm run android:sync`.
  Está en **Split Pay**.
- **Identificador do paquete**: `appId` no mesmo ficheiro. Cámbiao **antes** de publicar
  en ningures; despois xa non se pode. Está en **`com.splitpay.app`**.
- **Icono**: xa está posto. Sae de `public/icon.svg` e vive en
  `android/app/src/main/res/mipmap-*/`. Ver o apartado de abaixo.

## O paquete Java (paso manual, unha soa vez)

Ao pasar de `com.purchasesplit.app` a `com.splitpay.app` cambiaron o `applicationId` e o
`namespace` de `android/app/build.gradle`, e o `MainActivity.java` novo xa está en
`android/app/src/main/java/com/splitpay/app/`.

Queda **borrar a carpeta vella** `android/app/src/main/java/com/purchasesplit/`. Non rompe
nada se segue aí (é unha clase que xa non se usa), pero sobra.

Se prefires que o faga Android Studio: botón dereito sobre o paquete → *Refactor* →
*Rename*, marcando *Rename package*. Fai o mesmo e ademais move os ficheiros el só.

**Ollo**: para Android este APK é unha aplicación **distinta** da anterior. Instálase ao
lado da vella e arranca baleiro; os grupos que houbese no móbil quedan na app antiga.
Antes de desinstalala, exporta desde ela a copia de seguranza en JSON e impórtaa na nova.

## O icono

O icono do lanzador xa está xerado a partir de **`public/icon.svg`** (o cadrado verde
`#0f766e` co símbolo de porcentaxe). Ocupa estes ficheiros:

| Ficheiro | Para que |
|---|---|
| `res/mipmap-*/ic_launcher.png` | icono cadrado, Android 7 e anteriores |
| `res/mipmap-*/ic_launcher_round.png` | icono redondo, lanzadores que o piden |
| `res/mipmap-*/ic_launcher_foreground.png` | primeiro plano do **icono adaptativo** (Android 8+) |
| `res/values/ic_launcher_background.xml` | a cor do fondo do adaptativo (`#0F766E`) |
| `ic_launcher-playstore.png` | os 512×512 que pide Google Play |

No icono adaptativo o sistema recorta o fondo coa forma que lle pete (círculo, squircle,
pétalo…), así que o símbolo vai escalado a 84 dp dentro do lenzo de 108 dp: entra enteiro
na **zona segura** de 72 dp e non o corta ningunha máscara.

`npm run android:sync` **non toca** estes ficheiros: son do proxecto nativo, non da web.

Se cambias `public/icon.svg` e queres refacelos, en Android Studio: clic dereito en `app`
→ *New* → *Image Asset*, escolle o SVG como *foreground* e `#0F766E` como *background*.

## Sacar o APK

- **Para probar**: *Build* → *Build Bundle(s) / APK(s)* → *Build APK(s)*. Sae en
  `android/app/build/outputs/apk/debug/`.
- **Para distribuír**: *Build* → *Generate Signed Bundle / APK*. Garda ben o keystore: sen
  el non poderás publicar actualizacións da mesma app nunca máis.

## O que cambia respecto da versión web

- **Compartir vai por código, non por ligazón.** Dentro do APK non hai enderezo web ao que
  apuntar, así que a app dáche un código: cópiao, mándao por onde queiras e a outra persoa
  pégao en «Unirse». Se algún día colgas a web nun dominio, ponno en
  `src/config/app.ts` e volven saír ligazóns.
- **O QR funciona igual de móbil a móbil**: leva o código dentro. Nos grupos en liña sempre
  cabe; nos locais, só se o grupo é pequeno (a app avísate se non).
- **Non hai service worker nin manifest de PWA**: dentro do APK os ficheiros xa están no
  teléfono, así que eses restos de web eliminámolos.
- **Firebase e a IA seguen sendo opcionais**: se `src/config/firebase.ts` e
  `src/config/openai.ts` están baleiros, esas funcións non aparecen e a app é 100% local.

## Se algo falla

- **Pantalla en branco ao abrir**: non se copiou a web. Executa `npm run android:sync` e
  volve lanzar.
- **Android Studio non atopa o SDK**: ábreo unha vez só, deixa que instale o SDK e volve
  probar.
- **Erro de Gradle a estrear**: a primeira compilación descarga medio internet; dálle
  tempo e execútaa outra vez se caduca.
- **A pantalla de arranque segue co logo de Capacitor**: está en
  `res/drawable*/splash.png` e `res/values/styles.xml`, e non se tocou.
- **Non se ven as fotos vellas nun móbil novo**: é o esperado. Sen Firebase Storage as
  fotos quedan no dispositivo onde se fixeron.
