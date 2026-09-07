<div align="center">

<img src="public/icon.svg" alt="Split Pay" width="96" height="96">

# Split Pay

**Reparte gastos compartidos en grupo — viaxes, pisos, ceas.**
Sen rexistro, sen servidor, e sen que os teus datos saian do teléfono se ti non queres.

<br>

[![Android](https://img.shields.io/badge/Android-APK-3DDC84?style=flat-square&logo=android&logoColor=white)](ANDROID.md)
[![Capacitor](https://img.shields.io/badge/Capacitor-7-119EFF?style=flat-square&logo=capacitor&logoColor=white)](https://capacitorjs.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![Vitest](https://img.shields.io/badge/probas-vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev)
[![Firebase](https://img.shields.io/badge/Firebase-opcional-FFCA28?style=flat-square&logo=firebase&logoColor=black)](#configuración)
[![OpenAI](https://img.shields.io/badge/IA-opcional-412991?style=flat-square&logo=openai&logoColor=white)](#configuración)

</div>

---

## Porque

Repartir a conta dunha viaxe ou os gastos dun piso non debería esixir que catro persoas se dean de alta nun servizo, acepten unhas condicións e deixen os seus datos nun servidor alleo. As apps que fan isto ben —Tricount, Splitwise— piden conta; as que non a piden adoitan quedarse curtas en canto o reparto se complica un pouco.

**Split Pay** vai polo camiño contrario: os datos viven no teléfono, a app abre sen
conexión porque non precisa ningunha, e non hai que rexistrarse en nada. Se despois queres
compartir un grupo con outra persoa, hai dous xeitos: pasarlle un código (unha foto do
grupo, sen servidor de por medio) ou configurar o teu propio Firebase e que se sincronice
soa. As dúas cousas son túas; ningunha é obrigatoria.

Ademais resolve tres cousas que adoitan faltar: **varios pagadores nun mesmo gasto**,
**tipos de cambio conxelados** no movemento —para que os saldos vellos non cambien sós
cando se move o euro— e **galego** de serie, non como tradución a medio facer.

## Funcionalidades

### 💸 Gastos

- Grupos con moeda base e N participantes, **sen rexistro**.
- **Catro modos de reparto**: partes iguais, por partes, por importes exactos e por
  porcentaxe. Botóns de *todos / ningún*. O pagador pode non participar no reparto.
- **Varios pagadores** nun mesmo gasto.
- **Gastos recorrentes**: diarios, semanais ou mensuais. As repeticións vencidas xéranse
  soas ao abrir a app.
- **Fotos do ticket** adxuntas ao gasto.
- **Ingresos** (unha devolución, a fianza) e **reembolsos** entre dúas persoas.
- **Calculadora** no campo de importe: podes escribir `12,50 + 3*2`.
- 19 categorías agrupadas por temas.
- **Busca** por concepto, nota, persoa, categoría, data ou importe. A lista pagínase.

### 💱 Diñeiro

- Todas as moedas **ISO 4217**, cos seus decimais reais (o iene non ten céntimos; o dinar
  kuwaití ten tres).
- **Tipos de cambio en vivo** desde a API pública do Banco Central Europeo, ou a man.
  O tipo queda **conxelado** no movemento, así que os saldos non cambian sós.
- Saldos por persoa e **dous xeitos de saldar contas**: **bote** (o mínimo de pagos) e
  **festa** (cada un lle paga a quen adiantou o que consumiu, gasto a gasto). Botón para
  **compartir os pagos** como texto.
- **Saldo global** sumando todos os grupos.

### 📊 Resumo

- Selector de período: todo, este mes, mes pasado, 3 meses, 12 meses, este ano.
- Evolución mensual, por categoría (**clicable**, ábreche os gastos), por persoa,
  o que puxeches ti fronte á túa parte, e canto do total é gasto recorrente.
- Export a **CSV** e a **JSON**, no idioma activo. Copia de seguranza completa.

### 👥 Grupo

- **Rexistro de actividade**: quen engadiu, editou ou borrou que, e cando.
- Notas do grupo, favoritos, arquivar.
- Compartir por **código** e por **código QR**, con escáner para unirse.
- Segue o tema (claro ou escuro) que teña o teléfono.

## Configuración

### Requisitos

| Ferramenta | Versión |
|---|---|
| Node.js | 18 ou superior |
| npm | incluído con Node |
| Android Studio | Ladybug ou superior, co SDK de Android |
| JDK | 17 (o que trae Android Studio) |

### 🔥 Firebase — grupos en liña e fotos compartidas

Pega en `src/config/firebase.ts` a configuración web do teu proxecto. Con ela:

- ao crear un grupo podes escoller **local** ou **en liña**;
- as fotos van a **Firebase Storage** (se enches `storageBucket`) e véas todo o grupo.

Sen configuración, todos os grupos son locais e as fotos quedan no **IndexedDB** deste
teléfono (a app dío en cada gasto).

Precisa Cloud Firestore activado; o propio ficheiro trae as regras mínimas comentadas.
Ollo: **son abertas**, e quen adiviñe un token le e escribe. Os tokens son aleatorios de 22
caracteres, pero para uso serio engade autenticación.

### 🤖 OpenAI — escanear tickets e suxerir categoría

Con `apiKey` chea en `src/config/openai.ts` aparecen:

- **Escanear ticket**: fas unha foto e enche importe, moeda, data, concepto e categoría.
- **Suxerir categoría** a partir do título.

Vale calquera endpoint compatible con OpenAI (Ollama, LM Studio, un proxy teu).

> [!WARNING]
> **A chave viaxa ao dispositivo.** Esta app non ten servidor, así que a chamada faise
> desde o cliente. Úsaa só para ti, ou apunta `baseUrl` a un proxy que garde a chave de
> verdade.

### 🌐 `src/config/app.ts` — se tes dominio

`PUBLIC_URL` está baleiro a propósito: iso é o que fai que se comparta por código. Se
colgas a web nun enderezo real, ponno aí e volven saír ligazóns automaticamente.

## Estrutura xeral

```
split-pay/
├── src/
│   ├── components/      pantallas e compoñentes da interface
│   ├── lib/             motor de reparto, recorrencias, datas, códec, CSV
│   ├── i18n/            dicionarios gl · es · en (gl.ts é a referencia)
│   ├── config/          firebase.ts · openai.ts · app.ts
│   └── App.tsx          rutas e arranque
├── android/             proxecto nativo xerado por Capacitor
├── public/icon.svg      fonte do icono
├── docs/
│   ├── tecnico.md       mapa do código, sincronización e decisións
│   └── ANDROID.md       SDK, comandos, icono, APK e erros típicos
├── capacitor.config.ts  appId, appName, webDir
└── package.json
```

## Evolución por versión

### v1.0.0 — Primeira versión estable

- Documentación técnica e de Android en `docs/`.
- README completo: porqué, funcionalidades, configuración e estrutura.
- Primeira versión estable.

### v0.14.0 — Botón atrás nativo

- O botón atrás de Android pecha a folla aberta, despois volve á portada e só aí sae da app.
- Nova dependencia `@capacitor/app`; require `npm install` e `npx cap sync android`.

### v0.13.0 — Android con Capacitor

- A app empaquétase para Android con Capacitor: `npm run android`.
- Icono propio en todas as densidades, tamén o adaptativo.

### v0.12.0 — Fotos dos tickets e IA

- Fotos do ticket no gasto: van a Firebase Storage se o hai, e se non ao IndexedDB do dispositivo.
- Escaneo do ticket e categoría suxerida cun modelo compatible con OpenAI, tamén opcional.
- Máis probas dos extras.

### v0.11.0 — Sincronización opcional

- Grupos en liña opcionais con Cloud Firestore: quen non queira, non configura nada.
- Fusión movemento a movemento (o máis recente manda), non do grupo enteiro.

### v0.10.0 — Compartir por código e por QR

- Compartir un grupo nun código comprimido, sen servidor de por medio.
- Código QR co grupo dentro e escáner para unirse.
- `PUBLIC_URL` en `src/config/app.ts`: se algún día hai dominio, volven saír ligazóns.

### v0.9.0 — Recorrentes, busca, actividade e resumo

- Gastos recorrentes: diarios, semanais ou mensuais, xerados ao abrir a app.
- Busca por concepto, nota, persoa, categoría, data ou importe.
- Rexistro de actividade do grupo.
- Resumo con selector de período e desglose clicable.
- Export a CSV e a JSON.

### v0.8.0 — Multimoeda

- Todas as moedas ISO 4217, cos seus decimais reais.
- Tipo de cambio conxelado no movemento: os saldos vellos non cambian sós.
- Tipos en vivo desde a API pública do Banco Central Europeo.

### v0.7.0 — Interface

- Portada coa lista de grupos, pantalla de grupo con pestanas e editor de movementos.
- Pestana de saldos con «como saldar as contas».
- Axustes do grupo e axustes da app.
- Tema claro ou escuro, o que teña o dispositivo.

### v0.6.0 — Tres idiomas

- Sistema de idiomas tipado: se falta unha tradución, non compila.
- Galego (a referencia), castelán e inglés.

### v0.5.0 — Estado local

- Todo o estado vive no almacenamento do dispositivo: a app abre sen conexión.
- Preferencias por dispositivo: idioma, tema e modo de saldar.

### v0.4.0 — Saldar contas

- Dous xeitos de saldar contas: **bote** (o mínimo de pagos) e **festa** (cada un lle paga a quen adiantou o que consumiu).
- O neto de cada persoa segue sendo exactamente o seu saldo nos dous modos.

### v0.3.0 — Movementos e saldos

- Altas, edicións e borrado lóxico de movementos.
- Gastos con varios pagadores, ingresos e reembolsos.
- Saldos por participante.

### v0.2.0 — Núcleo do diñeiro e do reparto

- Tipos do dominio: grupos, participantes e movementos.
- Aritmética en unidades mínimas: nin un céntimo perdido no reparto.
- Catro modos de reparto: partes iguais, por partes, por importes e por porcentaxe.
- Primeiras probas do núcleo.

### v0.1.0 — Andamio do proxecto

- Andamio con Vite, React e TypeScript.
- Punto de entrada, folla de estilos e configuración de compilación.

## Autor

[Ismael Castiñeira](https://ipardelo.es)

```bash
VIVA GHALISIA E A COSTA DA MORTE! 💀
```
