# Split Pay

**Reparte gastos compartidos en grupo — viaxes, pisos, ceas.**
Sen rexistro, sen servidor, e sen que os teus datos saian do teléfono se ti non queres.

## Funcionalidades

- Proxecto React + TypeScript que compila con Vite.
- Catro modos de reparto: partes iguais, por partes, por importes exactos e por porcentaxe.
- Contas en unidades mínimas, con reparto de restos.
- Varios pagadores nun mesmo gasto, ingresos e reembolsos.
- Saldo de cada participante.
- Dous xeitos de saldar contas: bote e festa.
- Local-first: os datos non saen do dispositivo se ti non queres.
- Tres idiomas: galego, castelán e inglés. O galego é a referencia.
- Interface completa: grupos, movementos, saldos e axustes.
- Segue o tema claro ou escuro do dispositivo.
- Todas as moedas ISO 4217, con tipo de cambio conxelado no movemento.
- Tipos de cambio en vivo do Banco Central Europeo.
- Gastos recorrentes diarios, semanais ou mensuais.
- Busca, rexistro de actividade e resumo por período.
- Export a CSV e a JSON.
- Compartir grupos por código comprimido e por código QR, con escáner.
- Sincronización opcional con Firebase, con fusión movemento a movemento.

## Arrancar

```bash
npm install
npm run dev
```

## Evolución por versión

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
