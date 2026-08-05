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

## Arrancar

```bash
npm install
npm run dev
```

## Evolución por versión

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
