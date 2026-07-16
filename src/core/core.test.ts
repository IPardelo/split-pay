import { describe, expect, it } from 'vitest'
import { computeBalances, balanceMap, totalSpent } from './balances'
import { buildEntry, buildTransfer } from './entries'
import { convert, defaultRatesFor } from './fx'
import { decimalsFor, formatCents, fromUnits, parseAmountExpression } from './money'
import { directTransfers, settle, settleTransfers, transfersToText } from './settle'
import { SplitError, allocate, equalSpec, resolveSplit, validateSplit } from './split'
import type { Group, Participant } from './types'

/* ------------------------------ utilidades ------------------------------ */

function makeGroup(names: string[], baseCurrency = 'EUR'): Group {
  const participants: Participant[] = names.map((name, i) => ({
    id: `p${i}`,
    name,
    color: '#000',
    deletedAt: null,
  }))
  return {
    id: 'g',
    shareToken: 't',
    sync: 'LOCAL',
    title: 'Test',
    description: '',
    baseCurrency,
    participants,
    entries: [],
    activities: [],
    rates: defaultRatesFor(baseCurrency),
    ratesUpdatedAt: null,
    favorite: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    archivedAt: null,
    meParticipantId: 'p0',
  }
}

/** PRNG determinista, para que los fuzz tests sean reproducibles. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/* -------------------------------- allocate ------------------------------- */

describe('allocate', () => {
  it('reparte 10,00 € entre 3 sen perder un céntimo', () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333])
  })

  it('respecta os pesos', () => {
    expect(allocate(1000, [2, 1, 1])).toEqual([500, 250, 250])
    expect(allocate(100, [3, 1])).toEqual([75, 25])
  })

  it('é determinista: mesmas entradas, mesma saída', () => {
    const a = allocate(9999, [1, 1, 1, 1, 1, 1, 7])
    const b = allocate(9999, [1, 1, 1, 1, 1, 1, 7])
    expect(a).toEqual(b)
  })

  it('mantén o invariante suma == total en 20.000 casos aleatorios', () => {
    const rand = rng(42)
    for (let i = 0; i < 20000; i++) {
      const n = 1 + Math.floor(rand() * 8)
      const total = Math.floor(rand() * 1_000_000)
      const weights = Array.from({ length: n }, () => 1 + Math.floor(rand() * 10))
      const parts = allocate(total, weights)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
      expect(parts.every((p) => p >= 0)).toBe(true)
    }
  })

  it('funciona con importes negativos (ingresos)', () => {
    const parts = allocate(-1000, [1, 1, 1])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(-1000)
  })

  it('acepta pesos fraccionarios (porcentaxes)', () => {
    const parts = allocate(10000, [33.33, 33.33, 33.34])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000)
  })

  it('rexeita pesos negativos e sumas cero', () => {
    expect(() => allocate(100, [-1, 2])).toThrow(SplitError)
    expect(() => allocate(100, [0, 0])).toThrow(SplitError)
  })
})

/* ------------------------------ resolveSplit ----------------------------- */

describe('resolveSplit', () => {
  it('EQUAL reparte a partes iguais', () => {
    const out = resolveSplit(1000, equalSpec(['a', 'b', 'c']))
    expect(out.map((o) => o.amount)).toEqual([334, 333, 333])
  })

  it('SHARES pondera por partes', () => {
    const out = resolveSplit(1200, {
      mode: 'SHARES',
      entries: [
        { participantId: 'a', value: 2 },
        { participantId: 'b', value: 1 },
      ],
    })
    expect(out).toEqual([
      { participantId: 'a', amount: 800 },
      { participantId: 'b', amount: 400 },
    ])
  })

  it('EXACT esixe que os importes cadren', () => {
    const spec = {
      mode: 'EXACT' as const,
      entries: [
        { participantId: 'a', value: 600 },
        { participantId: 'b', value: 400 },
      ],
    }
    expect(resolveSplit(1000, spec).map((o) => o.amount)).toEqual([600, 400])
    expect(() => resolveSplit(999, spec)).toThrow(SplitError)
  })

  it('PERCENT valida que sume 100', () => {
    const ok = validateSplit(1000, {
      mode: 'PERCENT',
      entries: [
        { participantId: 'a', value: 60 },
        { participantId: 'b', value: 40 },
      ],
    })
    expect(ok.ok).toBe(true)
    const bad = validateSplit(1000, {
      mode: 'PERCENT',
      entries: [
        { participantId: 'a', value: 60 },
        { participantId: 'b', value: 30 },
      ],
    })
    expect(bad.ok).toBe(false)
  })
})

/* -------------------------------- balances ------------------------------- */

describe('saldos', () => {
  it('os saldos suman sempre cero', () => {
    const g = makeGroup(['Ana', 'Bea', 'Caro'])
    const e1 = buildEntry(g, {
      type: 'EXPENSE',
      title: 'Cena',
      category: 'food',
      date: '2026-01-02',
      currency: 'EUR',
      amountOriginal: 6000,
      payers: [{ participantId: 'p0', amount: 6000 }],
      split: equalSpec(['p0', 'p1', 'p2']),
      note: '',
    })
    const g2 = { ...g, entries: [e1] }
    const balances = computeBalances(g2)
    expect(balances.reduce((a, b) => a + b.balance, 0)).toBe(0)
    expect(balances.find((b) => b.participantId === 'p0')!.balance).toBe(4000)
    expect(balances.find((b) => b.participantId === 'p1')!.balance).toBe(-2000)
  })

  it('o pagador pode non participar no reparto', () => {
    const g = makeGroup(['Ana', 'Bea', 'Caro'])
    const e = buildEntry(g, {
      type: 'EXPENSE',
      title: 'Regalo para Ana',
      category: 'general',
      date: '2026-01-02',
      currency: 'EUR',
      amountOriginal: 3000,
      payers: [{ participantId: 'p0', amount: 3000 }],
      split: equalSpec(['p1', 'p2']),
      note: '',
    })
    const balances = computeBalances({ ...g, entries: [e] })
    expect(balances.find((b) => b.participantId === 'p0')!.balance).toBe(3000)
    expect(balances.find((b) => b.participantId === 'p1')!.balance).toBe(-1500)
    expect(balances.reduce((a, b) => a + b.balance, 0)).toBe(0)
  })

  it('soporta varios pagadores sen descadre', () => {
    const g = makeGroup(['Ana', 'Bea', 'Caro'])
    const e = buildEntry(g, {
      type: 'EXPENSE',
      title: 'Hotel',
      category: 'lodging',
      date: '2026-01-03',
      currency: 'EUR',
      amountOriginal: 10001,
      payers: [
        { participantId: 'p0', amount: 5000 },
        { participantId: 'p1', amount: 5001 },
      ],
      split: equalSpec(['p0', 'p1', 'p2']),
      note: '',
    })
    expect(e.payers.reduce((a, p) => a + p.amount, 0)).toBe(e.amountBase)
    expect(e.shares.reduce((a, s) => a + s.amount, 0)).toBe(e.amountBase)
  })

  it('un movemento borrado deixa de contar', () => {
    const g = makeGroup(['Ana', 'Bea'])
    const e = buildEntry(g, {
      type: 'EXPENSE',
      title: 'X',
      category: 'general',
      date: '2026-01-02',
      currency: 'EUR',
      amountOriginal: 1000,
      payers: [{ participantId: 'p0', amount: 1000 }],
      split: equalSpec(['p0', 'p1']),
      note: '',
    })
    const withDeleted = { ...g, entries: [{ ...e, deletedAt: '2026-01-04T00:00:00Z' }] }
    expect(totalSpent(withDeleted)).toBe(0)
    expect(computeBalances(withDeleted).every((b) => b.balance === 0)).toBe(true)
  })

  it('un ingreso inverte o signo', () => {
    const g = makeGroup(['Ana', 'Bea'])
    const e = buildEntry(g, {
      type: 'INCOME',
      title: 'Devolución fianza',
      category: 'general',
      date: '2026-01-05',
      currency: 'EUR',
      amountOriginal: 5000,
      payers: [{ participantId: 'p0', amount: 5000 }],
      split: equalSpec(['p0', 'p1']),
      note: '',
    })
    expect(e.amountBase).toBe(-5000)
    const balances = balanceMap({ ...g, entries: [e] })
    // Ana recibió 5.000, así que le debe 2.500 a Bea.
    expect(balances['p0']).toBe(-2500)
    expect(balances['p1']).toBe(2500)
  })
})

/* -------------------------------- settle -------------------------------- */

describe('settle', () => {
  it('deixa todos os saldos a cero', () => {
    const balances = { a: 5000, b: -2000, c: -3000 }
    const transfers = settle(balances)
    const after = { ...balances }
    for (const t of transfers) {
      after[t.from as keyof typeof after] += t.amount
      after[t.to as keyof typeof after] -= t.amount
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true)
  })

  it('cancela pares exactos cun só pago', () => {
    const transfers = settle({ a: 2500, b: -2500, c: 1000, d: -1000 })
    expect(transfers).toHaveLength(2)
  })

  it('nunca xera máis de n−1 transferencias (fuzz)', () => {
    const rand = rng(7)
    for (let i = 0; i < 2000; i++) {
      const n = 2 + Math.floor(rand() * 7)
      const raw = Array.from({ length: n }, () => Math.floor(rand() * 20000) - 10000)
      const sum = raw.reduce((a, b) => a + b, 0)
      raw[0] -= sum // fuerza suma cero
      const balances: Record<string, number> = {}
      raw.forEach((v, j) => (balances[`p${j}`] = v))

      const transfers = settle(balances)
      const after = { ...balances }
      for (const t of transfers) {
        after[t.from] += t.amount
        after[t.to] -= t.amount
      }
      expect(Object.values(after).every((v) => v === 0)).toBe(true)
      expect(transfers.length).toBeLessThanOrEqual(n - 1)
      expect(transfers.every((t) => t.amount > 0)).toBe(true)
    }
  })

  it('non propón nada se xa está todo saldado', () => {
    expect(settle({ a: 0, b: 0 })).toEqual([])
  })
})

/* --------------------- saldar contas: bote vs. festa --------------------- */

/** A festa dos cinco amigos, tal cal a contou o usuario. */
function party() {
  const g = makeGroup(['Ismael', 'Carina', 'Paulo', 'Hucho', 'Bea'])
  const id = { Ismael: 'p0', Carina: 'p1', Paulo: 'p2', Hucho: 'p3', Bea: 'p4' } as const
  const add = (title: string, payer: keyof typeof id, cents: number, eaters: (keyof typeof id)[]) => {
    g.entries.push(
      buildEntry(g, {
        type: 'EXPENSE',
        title,
        category: 'food',
        date: '2026-09-05',
        currency: 'EUR',
        amountOriginal: cents,
        payers: [{ participantId: id[payer], amount: cents }],
        split: equalSpec(eaters.map((n) => id[n])),
        note: '',
      }),
    )
  }
  add('Bebida', 'Paulo', 3000, ['Ismael', 'Hucho'])
  add('Tortillas', 'Ismael', 2500, ['Ismael', 'Carina', 'Paulo', 'Hucho', 'Bea'])
  add('Churrasco', 'Carina', 4000, ['Bea', 'Carina'])
  add('Salchichas', 'Paulo', 1500, ['Hucho', 'Paulo', 'Ismael'])
  return { g, id }
}

/** O neto de cada un segundo unha lista de pagos. */
function netOf(transfers: { from: string; to: string; amount: number }[], ids: string[]) {
  const net: Record<string, number> = {}
  for (const i of ids) net[i] = 0
  for (const t of transfers) {
    net[t.from] -= t.amount
    net[t.to] += t.amount
  }
  return net
}

describe('débeda directa (modo festa)', () => {
  it('nos dous modos, o neto de cada un é exactamente o seu saldo', () => {
    const { g } = party()
    const ids = g.participants.map((p) => p.id)
    const bal = balanceMap(g)
    for (const mode of ['POOL', 'PARTY'] as const) {
      expect(netOf(settleTransfers(g, mode), ids)).toEqual(bal)
    }
  })

  it('cadaquén lle paga só a quen adiantou o que consumiu', () => {
    const { g, id } = party()
    const pays = (from: string, to: string) =>
      directTransfers(g).find((t) => t.from === from && t.to === to)?.amount ?? 0

    // Bea só comeu churrasco (o pagou Carina) e tortilla (a pagou Ismael):
    // nunca lle debe nada a Paulo, que só puxo bebida e salchichas.
    expect(pays(id.Bea, id.Carina)).toBe(2000)
    expect(pays(id.Bea, id.Ismael)).toBe(500)
    expect(pays(id.Bea, id.Paulo)).toBe(0)

    // Ismael queda a cero de saldo, pero non está fóra: cobra as tortillas e
    // paga a bebida e as salchichas.
    expect(pays(id.Ismael, id.Paulo)).toBe(1500)
    expect(pays(id.Hucho, id.Ismael)).toBe(500)
  })

  it('o bote agrupa e a festa non: son listas distintas', () => {
    const { g, id } = party()
    expect(settle(balanceMap(g)).some((t) => t.from === id.Bea && t.to === id.Paulo)).toBe(true)
    expect(directTransfers(g).some((t) => t.from === id.Bea && t.to === id.Paulo)).toBe(false)
  })

  it('entre dúas persoas nunca queda máis dun pago, e sempre positivo', () => {
    const { g } = party()
    const seen = new Set<string>()
    for (const t of directTransfers(g)) {
      const key = [t.from, t.to].sort().join('|')
      expect(seen.has(key)).toBe(false)
      seen.add(key)
      expect(t.amount).toBeGreaterThan(0)
      expect(t.from).not.toBe(t.to)
    }
  })

  it('un reembolso rexistrado resta débeda', () => {
    const { g, id } = party()
    const antes = directTransfers(g).find((t) => t.from === id.Hucho && t.to === id.Paulo)!.amount
    g.entries.unshift(buildTransfer(g, id.Hucho, id.Paulo, 1000, '2026-09-06', 'Reembolso'))
    const despois = directTransfers(g).find((t) => t.from === id.Hucho && t.to === id.Paulo)!.amount
    expect(despois).toBe(antes - 1000)
  })

  it('non propón nada nun grupo sen movementos', () => {
    const g = makeGroup(['Ana', 'Bea'])
    expect(directTransfers(g)).toEqual([])
    expect(transfersToText(g, [])).toBe('')
  })

  it('o texto para compartir leva nome, frecha e importe por liña', () => {
    const { g, id } = party()
    const text = transfersToText(g, [{ from: id.Bea, to: id.Carina, amount: 2000 }])
    expect(text.split('\n')).toHaveLength(1)
    expect(text).toContain('Bea')
    expect(text).toContain('→')
    expect(text).toContain('Carina')
    expect(text).toMatch(/20[.,]00/)
  })
})

/* ------------------------------ multidivisa ------------------------------ */

describe('multimoeda', () => {
  it('converte e conxela o tipo de cambio', () => {
    const g = makeGroup(['Ana', 'Bea'], 'EUR')
    const e = buildEntry(g, {
      type: 'EXPENSE',
      title: 'Taxi en Londres',
      category: 'transport',
      date: '2026-02-01',
      currency: 'GBP',
      amountOriginal: 2000, // 20,00 £
      payers: [{ participantId: 'p0', amount: 2000 }],
      split: equalSpec(['p0', 'p1']),
      note: '',
    })
    expect(e.fxRate).toBe(g.rates['GBP'])
    expect(e.amountBase).toBe(convert(2000, 'GBP', 'EUR', g.rates['GBP']))
    expect(e.shares.reduce((a, s) => a + s.amount, 0)).toBe(e.amountBase)

    // Cambiar el tipo del grupo no toca el movimiento ya registrado.
    const g2 = { ...g, rates: { ...g.rates, GBP: 2 }, entries: [e] }
    expect(g2.entries[0].amountBase).toBe(e.amountBase)
  })

  it('manexa moedas sen decimais', () => {
    expect(decimalsFor('JPY')).toBe(0)
    expect(fromUnits(5000, 'JPY')).toBe(5000)
    // 5000 ¥ son 5000 unidades, non 50,00: non debe aparecer parte decimal.
    expect(/[.,]\d{2}(\D|$)/.test(formatCents(5000, 'JPY'))).toBe(false)
  })
})

/* ------------------------------ transferencias --------------------------- */

describe('transferencias', () => {
  it('un reembolso move o saldo exacto', () => {
    const g = makeGroup(['Ana', 'Bea'])
    const gasto = buildEntry(g, {
      type: 'EXPENSE',
      title: 'Compra',
      category: 'groceries',
      date: '2026-03-01',
      currency: 'EUR',
      amountOriginal: 5000,
      payers: [{ participantId: 'p0', amount: 5000 }],
      split: equalSpec(['p0', 'p1']),
      note: '',
    })
    const g2 = { ...g, entries: [gasto] }
    expect(balanceMap(g2)['p1']).toBe(-2500)

    const pago = buildTransfer(g2, 'p1', 'p0', 2500, '2026-03-02', 'Reembolso')
    const g3 = { ...g2, entries: [pago, gasto] }
    const after = balanceMap(g3)
    expect(after['p0']).toBe(0)
    expect(after['p1']).toBe(0)
  })
})

/* -------------------------------- importes ------------------------------- */

describe('parseAmountExpression', () => {
  it('acepta coma e punto decimal', () => {
    expect(parseAmountExpression('12,50')).toBe(1250)
    expect(parseAmountExpression('12.50')).toBe(1250)
  })

  it('resolve aritmética simple', () => {
    expect(parseAmountExpression('12,50+3*2')).toBe(1850)
    expect(parseAmountExpression('(10+5)/2')).toBe(750)
    expect(parseAmountExpression('100-33,33')).toBe(6667)
  })

  it('redondea ao céntimo', () => {
    expect(parseAmountExpression('10/3')).toBe(333)
  })

  it('rexeita lixo e código', () => {
    expect(parseAmountExpression('abc')).toBeNull()
    expect(parseAmountExpression('alert(1)')).toBeNull()
    expect(parseAmountExpression('')).toBeNull()
    expect(parseAmountExpression('1/0')).toBeNull()
    expect(parseAmountExpression('((1)')).toBeNull()
  })
})

/* --------------------------- escenario completo -------------------------- */

describe('escenario de viaxe', () => {
  it('cadra de punta a punta', () => {
    const g = makeGroup(['Ana', 'Bea', 'Caro', 'Dani'])
    const entries = [
      buildEntry(g, {
        type: 'EXPENSE', title: 'Airbnb', category: 'lodging', date: '2026-05-01',
        currency: 'EUR', amountOriginal: 48000,
        payers: [{ participantId: 'p0', amount: 48000 }],
        split: equalSpec(['p0', 'p1', 'p2', 'p3']), note: '',
      }),
      buildEntry(g, {
        type: 'EXPENSE', title: 'Gasolina', category: 'transport', date: '2026-05-02',
        currency: 'EUR', amountOriginal: 7333,
        payers: [{ participantId: 'p1', amount: 7333 }],
        split: { mode: 'SHARES', entries: [
          { participantId: 'p0', value: 1 }, { participantId: 'p1', value: 1 },
          { participantId: 'p2', value: 2 },
        ] }, note: '',
      }),
      buildEntry(g, {
        type: 'EXPENSE', title: 'Cena', category: 'food', date: '2026-05-03',
        currency: 'EUR', amountOriginal: 12010,
        payers: [{ participantId: 'p2', amount: 6000 }, { participantId: 'p3', amount: 6010 }],
        split: { mode: 'PERCENT', entries: [
          { participantId: 'p0', value: 25 }, { participantId: 'p1', value: 25 },
          { participantId: 'p2', value: 25 }, { participantId: 'p3', value: 25 },
        ] }, note: '',
      }),
    ]
    const group = { ...g, entries }

    expect(totalSpent(group)).toBe(48000 + 7333 + 12010)
    for (const e of entries) {
      expect(e.shares.reduce((a, s) => a + s.amount, 0)).toBe(e.amountBase)
      expect(e.payers.reduce((a, p) => a + p.amount, 0)).toBe(e.amountBase)
    }

    const balances = balanceMap(group)
    expect(Object.values(balances).reduce((a, b) => a + b, 0)).toBe(0)

    const transfers = settle(balances)
    const after = { ...balances }
    for (const t of transfers) {
      after[t.from] += t.amount
      after[t.to] -= t.amount
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true)
    expect(transfers.length).toBeLessThanOrEqual(3)
  })
})
