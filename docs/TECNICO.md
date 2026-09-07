# Split Pay — detalles técnicos

O que non cabía no [README](../README.md): comandos, mapa do código, as decisións que
convén coñecer antes de tocar nada, e onde están os límites.

Para compilar o APK, o permiso da cámara e o icono, mira [ANDROID.md](../ANDROID.md).

---

## Scripts

| Script | Que fai |
|---|---|
| `npm run android` | build + sync + abre Android Studio |
| `npm run android:sync` | build + copia a web dentro do proxecto Android |
| `npm run android:init` | crea `android/` (só a primeira vez) |
| `npm run dev` | servidor de desenvolvemento en `http://localhost:5173` (para traballar no ordenador) |
| `npm run build` | typecheck + build de produción en `dist/` |
| `npm test` | probas do motor, recorrencias, busca, fusión e dicionarios |
| `npm run typecheck` | só o typecheck |

`npm run dev` é só para desenvolver: no navegador do ordenador iteras moito máis rápido que
recompilando o APK. O que se distribúe é sempre o APK.

---

## Mapa do código

```
src/
  core/          O motor. Sen React, sen DOM, testeable en illamento.
    types.ts       Modelo de datos
    money.ts       Unidades mínimas, formato e o avaliador do campo de importe
    split.ts       Reparto con restos maiores + validación (con códigos de erro)
    balances.ts    Saldos e agregados, con rango de datas
    settle.ts      Saldar contas: modo bote (mínimos pagos) e modo festa (débeda directa)
    fx.ts          Moedas ISO e tipos de cambio
    entries.ts     Construción dun movemento pechado e conxelado
    recurrence.ts  Gastos recorrentes e aritmética de datas
    search.ts      Busca
    statsRange.ts  Períodos do resumo
    activity.ts    Rexistro de actividade
    merge.ts       Fusión de dúas versións do grupo + JSON canónico
  i18n/          Dicionarios gl · es · en e o selector de idioma
  config/        app.ts, firebase.ts e openai.ts — os ficheiros que tes que encher
  sync/          Adaptador de Firebase (carga perezosa) e motor de sincronización
  store/         Estado e persistencia en localStorage
  lib/           Compartición, CSV/JSON, fotos, IA e tipos de cambio en vivo
  ui/            Pantallas e compoñentes

capacitor.config.ts   Nome, appId e configuración do envoltorio nativo
android/              Proxecto Android (xérase con `npm run android:init`)
```

A regra que mantén isto sán: **`core/` non importa nada de React nin toca o DOM**. Todo o
que se pode probar sen navegador vive alí, e por iso as probas corren en milisegundos.

---

## Os dicionarios

Os textos viven en `src/i18n/`. **`gl.ts` é a referencia**: o tipo `Dict` sae del, así que
`es.ts` e `en.ts` teñen que ter exactamente as mesmas chaves — **esquecer unha tradución
rompe o `npm run build`**, non se descobre en produción.

Un test comproba ademais que cada frase use as mesmas variables (`{name}`, `{amount}`…) nos
tres idiomas, que é o erro que o tipo non colle.

---

## Como sincroniza

Cada grupo en liña é un documento de Firestore identificado polo seu token.

Cando chega unha versión do servidor **non se sobrescribe o grupo enteiro**: fusiónase
movemento a movemento, e gaña o que teña o `updatedAt` máis recente (*last-write-wins* por
movemento, non por documento). Así dúas persoas poden apuntar gastos á vez sen pisarse, e
un borrado nunca resucita.

A comparación entre versións faise con **JSON canónico** (claves ordenadas) para que dous
dispositivos co mesmo contido produzan a mesma cadea. Sen iso, os dous lados detectarían
sempre unha diferenza e escribiríanse en bucle.

Hai probas de que a fusión é **idempotente** (fusionar dúas veces dá o mesmo) e
**conmutativa** (a orde de chegada non importa).

Sen Firebase configurado non hai rede ningunha de por medio: a app funciona igual, só que
cada teléfono ten os seus grupos.

---

## Decisións que convén coñecer

| | |
|---|---|
| **Todo en unidades mínimas enteiras** | Nin un só importe se garda como decimal. O reparto usa restos maiores con desempate determinista, e o invariante `suma(partes) === total` está cuberto por un fuzz de 20.000 casos. |
| **Os números conxélanse ao gardar** | O tipo de cambio, o importe en moeda base e os dous repartos calcúlanse unha vez e gárdanse no movemento. Se mañá se move o euro, os saldos de onte non cambian. |
| **Borrado lóxico en todo** | Un gasto borrado segue no historial e pódese restaurar. Un participante con movementos desactívase, non se elimina. |
| **As recorrencias non son plantillas invisibles** | O último movemento da cadea leva a data da seguinte; cando se xera, o novo pasa a ser o último. O que ves no historial é exactamente o que conta. |
| **A liquidación é un greedy** | O mínimo real é NP-difícil: primeiro cancélanse os pares exactos e logo emparéllase o maior debedor co maior acredor. Como moito n−1 pagos. |
| **O SDK de Firebase cárgase perezoso** | Non se descarga ata que hai configuración. Un usuario que nunca active a sincronización non paga o custo. |

---

## Limitacións

- **Compartir vai por código, non por ligazón**: dentro do APK non hai enderezo web ao que
  apuntar. Se algún día colgas a web nun dominio, ponno en `src/config/app.ts`
  (`PUBLIC_URL`) e volven saír ligazóns automaticamente.
- **O código dun grupo local é unha foto**, non sincroniza. Para traballar a varias mans,
  grupo **en liña**.
- **O QR ten un límite**: nos grupos en liña sempre cabe (é só o token); nos locais leva o
  grupo enteiro dentro e só cabe se é pequeno. A app avísate cando non.
- O **escáner QR** usa `BarcodeDetector`: nun WebView vello pode non estar. Nese caso a app
  dío e pégase o código a man.
- **As regras de Firestore do exemplo son abertas.** Quen adiviñe un token le e escribe.
  Para uso serio, autenticación e regras por grupo.
- Sen base de datos, todo o grupo vive en memoria: para un grupo normal vai sobrado, pero
  non está pensado para decenas de miles de gastos.
- Os datos locais viven no `localStorage` (e as fotos locais no IndexedDB). Se borras os
  datos da app, vanse: **exporta a copia de seguranza de cando en vez**.

---

## Fronte a Spliit

[Spliit](https://github.com/spliit-app/spliit) é o clon open source de Splitwise, e de aí
saíron boa parte das ideas desta app. As diferenzas reais:

**O que ten Spliit e aquí non.** Ten unha base de datos PostgreSQL detrás, e diso veñen a
paxinación e as estatísticas en SQL: pídelle ao servidor *os 20 gastos da páxina 3* e *a
suma por categoría*, e ao dispositivo só chega iso. Aquí o grupo enteiro cárgase en memoria
e eses cálculos son un `filter`/`reduce` en JavaScript.

Para un piso ou unha viaxe —centos de gastos— a diferenza non se nota; a partir de decenas
de miles, si. O prezo desa vantaxe é un servidor, unha base de datos e unha conta.

Tampouco ten esta app os 35 idiomas traducidos por voluntarios, nin a imaxe de Docker, nin
as probas end-to-end con Playwright, nin a analítica opcional.

**O que ten esta e Spliit non.** Funciona sen infraestrutura ningunha e admite **varios
pagadores por gasto**.

---

## Seguinte paso

Autenticación de Firebase e regras por grupo. As do exemplo son abertas, e iso é o que hoxe
impide recomendar a sincronización para nada que importe.
